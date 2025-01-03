package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	websocketUpgrader = websocket.Upgrader{
		CheckOrigin:     checkOrigin,
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
)

type Manager struct {
	clients ClientList
	sync.RWMutex


	handlers map[string]EventHandler
	games    map[string]Game
}

func NewManager(ctx context.Context) *Manager {
	m := &Manager{
		clients:  make(ClientList),
		handlers: make(map[string]EventHandler),
		games:    make(map[string]Game),
	}

	m.setupEventHandlers()
	return m
}

func (m *Manager) setupEventHandlers() {
	m.handlers[EventSendInitializeGame] = InitializeGameHandler
}

func InitializeGameHandler(event Event, c *Client) error {
	var sendInitializeGameEvent SendInitializeGameEvent

	if err := json.Unmarshal(event.Payload, &sendInitializeGameEvent); err != nil {
		return fmt.Errorf("bad payload in request: %v", err)
	}

	var receiveInitializeGameEvent ReceiveInitializeGameEvent

	receiveInitializeGameEvent.JoinCode = NewJoinCode(2)
	receiveInitializeGameEvent.Sent = time.Now()

	data, err := json.Marshal(receiveInitializeGameEvent)
	if err != nil {
		return fmt.Errorf("failed to marshal broadcast message: %v", err)
	}

	outgoingEvent := Event{
		Payload: data,
		Type:    EventReceiveInitializeGame,
	}

	c.egress <- outgoingEvent

	c.GameID = NewGameID()

	return nil
}

func (m *Manager) routeEvent(event Event, c *Client) error {
	if handler, ok := m.handlers[event.Type]; ok {
		if err := handler(event, c); err != nil {
			return err
		}
		return nil
	} else {
		return errors.New("there is no such event type")
	}
}

func (m *Manager) serveWS(w http.ResponseWriter, r *http.Request) {
	log.Println("new connection")

	// upgrade regular http connection to websocket
	conn, err := websocketUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := NewClient(conn, m)

	m.addClient(client)

	// Start client processes
	go client.readMessages()
	go client.writeMessages()
}

func (m *Manager) addClient(client *Client) {
	m.Lock()
	defer m.Unlock()

	m.clients[client] = true
}

func (m *Manager) removeClient(client *Client) {
	m.Lock()
	defer m.Unlock()

	if _, ok := m.clients[client]; ok {
		client.connection.Close()
		delete(m.clients, client)
	}
}

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	switch origin {
	case "https://localhost:8080":
		return true
	default:
		return false
	}
}
