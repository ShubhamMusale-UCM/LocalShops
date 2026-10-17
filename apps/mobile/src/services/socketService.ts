import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../utils/constants';

export type DeliveryLocationPayload = {
  assignmentId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
};

class SocketService {
  private socket: Socket | null = null;

  connect(token?: string) {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token: `Bearer ${token}` } : undefined,
      autoConnect: true,
    });

    return this.socket;
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }

  joinOrder(orderId: string) {
    this.socket?.emit('order:subscribe', { orderId });
  }

  leaveOrder(orderId: string) {
    this.socket?.emit('order:unsubscribe', { orderId });
  }

  joinDelivery(assignmentId: string) {
    this.socket?.emit('delivery:join', { assignmentId });
  }

  sendDeliveryLocation(payload: DeliveryLocationPayload) {
    this.socket?.emit('delivery:location:update', payload);
  }

  onOrderStatus(cb: (payload: any) => void) {
    this.socket?.on('order:status:updated', cb);
  }

  onDeliveryLocation(cb: (payload: any) => void) {
    this.socket?.on('delivery:location:updated', cb);
  }

  onDeliveryEta(cb: (payload: any) => void) {
    this.socket?.on('delivery:eta:updated', cb);
  }

  onDeliveryChat(cb: (payload: any) => void) {
    this.socket?.on('delivery:chat:message', cb);
  }

  off(event: string, cb?: (...args: any[]) => void) {
    if (!this.socket) return;
    if (cb) {
      this.socket.off(event, cb);
      return;
    }
    this.socket.off(event);
  }

  joinShop(shopId: string) {
    if (!this.socket) this.connect();
    this.socket?.emit('shop:subscribe', { shopId });
  }

  onShopEvent(event: string, cb: (payload: any) => void) {
    if (!this.socket) this.connect();
    this.socket?.on(event, cb);
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }
}

export const socketService = new SocketService();
