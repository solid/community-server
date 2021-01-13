import type WebSocket from 'ws';
import { AsyncHandler } from '../util/handlers/AsyncHandler';
import type { HttpRequest } from './HttpRequest';

/**
 * A WebSocketHandler handles the communication with multiple WebSockets
 */
export abstract class WebSocketHandler
  extends AsyncHandler<{ webSocket: WebSocket; upgradeRequest: HttpRequest }> {}
