import {
  appState,
  GameStatus,
  renderInProgress,
  renderWaiting,
  setJoinCodeHtml,
  setPlayersInLobbyHtml,
  toast,
} from "./app.js";
import {
  BaseEvent,
  Event,
  EventPayloads,
  ReceiveInitializeGameEvent,
  ReceiveInvalidActionEvent,
  ReceiveJoinGameEvent,
  ReceivePlayerGiveActionPointEvent,
  ReceivePlayerIncreaseRangeEvent,
  ReceivePlayerMoveEvent,
  ReceivePlayerShootEvent,
  ReceiveStartGameEvent,
} from "./events.js";

export class WSDriver {
  conn: WebSocket | null;

  constructor() {
    this.conn = null;
  }

  connectWebsocket() {
    if (window["WebSocket"]) {
      console.log("supports websockets");

      this.conn = new WebSocket("wss://" + document.location.host + "/ws");

      this.conn.onopen = () => this.handleOpen();
      this.conn.onclose = () => this.handleClose();
      this.conn.onmessage = (e) => this.handleMessage(e);
    } else {
      alert("Browser does not support WebSockets");
    }
  }

  handleOpen() {
    console.log("handleOpen()");
  }

  handleClose() {
    console.log("handleClose()");
  }

  handleMessage(event: MessageEvent) {
    const eventData = JSON.parse(event.data);

    const e = Object.assign(
      new BaseEvent(eventData.type, eventData.payload),
      eventData,
    );

    this.routeEvent(e);
  }

  routeEvent(event: BaseEvent) {
    if (event.type === undefined) {
      alert("no type field in the event");
    }

    switch (event.type) {
      case "receive_initialize_game":
        const receiveInitializeGameEvent = new ReceiveInitializeGameEvent(
          event.payload.joinCode,
          event.payload.sent,
        );

        setJoinCodeHtml(receiveInitializeGameEvent.joinCode);
        setPlayersInLobbyHtml(1);
        break;

      case "receive_join_game":
        const receiveJoinGameEvent = new ReceiveJoinGameEvent(
          event.payload.playerCount,
          event.payload.isMainClient,
          event.payload.sent,
        );

        if (receiveJoinGameEvent.isMainClient) {
          setPlayersInLobbyHtml(receiveJoinGameEvent.playerCount);
        } else {
          renderWaiting();
          setPlayersInLobbyHtml(receiveJoinGameEvent.playerCount);
        }

        break;

      case "receive_start_game":
        const receiveStartGameEvent = new ReceiveStartGameEvent(
          event.payload.gameState,
          event.payload.sent,
        );

        appState.currentState = GameStatus.InProgress;
        renderInProgress(appState, this, receiveStartGameEvent.gameState);
        break;

      case "receive_player_move":
        const receivePlayerMoveEvent = new ReceivePlayerMoveEvent(
          event.payload.gameState,
          event.payload.sent,
        );

        if (appState.game) {
          appState.game.state = receivePlayerMoveEvent.gameState;
        }

        break;

      case "receive_player_shoot":
        const receivePlayerShootEvent = new ReceivePlayerShootEvent(
          event.payload.gameState,
          event.payload.sent,
        );

        if (appState.game) {
          appState.game.state = receivePlayerShootEvent.gameState;
        }
        break;

      case "receive_player_increase_range":
        const receivePlayerIncreaseRangeEvent =
          new ReceivePlayerIncreaseRangeEvent(
            event.payload.gameState,
            event.payload.sent,
          );

        if (appState.game) {
          appState.game.state = receivePlayerIncreaseRangeEvent.gameState;
        }
        break;

      case "receive_player_give_action_point":
        const receivePlayerGiveActionPointEvent =
          new ReceivePlayerGiveActionPointEvent(
            event.payload.gameState,
            event.payload.sent,
          );

        if (appState.game) {
          appState.game.state = receivePlayerGiveActionPointEvent.gameState;
        }
        break;

      case "receive_invalid_action":
        const receiveInvalidActionEvent = new ReceiveInvalidActionEvent(
          event.payload.message,
          event.payload.sent,
        );

        toast(receiveInvalidActionEvent.message);
        break;

      default:
        alert("unsupported message type");
    }
  }

  sendEvent<T extends keyof EventPayloads>(
    eventName: T,
    payload: EventPayloads[T],
  ) {
    const event = new Event(eventName, payload);

    if (this.conn) {
      this.conn.send(JSON.stringify(event));
    }
  }
}
