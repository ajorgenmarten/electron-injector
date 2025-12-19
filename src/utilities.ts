import { IpcMainEvent, IpcMainInvokeEvent } from 'electron';

export class Reflector {
  get<T = any>(key: any, target: any) {
    return Reflect.getMetadata(key, target) as T;
  }

  getAll<T = any>(key: any, ...targets: any[]) {
    return targets.map((t) => this.get<T>(key, t));
  }

  getAllAndOverride<T = any>(key: any, ...targets: any[]) {
    return this.getAll<T>(key, ...targets)
      .reverse()
      .find((value) => value !== undefined);
  }

  getAllAndMerge<T = any>(key: any, ...targets: any[]): T {
    return this.getAll(key, ...targets).reduce((a, b) => {
      if (Array.isArray(a)) return a.concat(b);
      if (typeof a === 'object' && typeof b === 'object') return { ...a, ...b };
      return b;
    }, []);
  }
}

export class ExecutionContext {
  constructor(
    private readonly _classRef: any,
    private readonly _handler: CallableFunction,
    private _payload: any,
    private _event: IpcMainEvent | IpcMainInvokeEvent,
  ) {}

  getHandler() {
    return this._handler;
  }

  getClass<T = any>() {
    return this._classRef as T;
  }

  get payload() {
    return this._payload;
  }

  get event() {
    return this._event;
  }

  set payload(payload: any) {
    this._payload = payload;
  }
}

export function applyDecorators(...decorators: CallableFunction[]) {
  return function (
    target: Object,
    _propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    const targetKey = descriptor ? descriptor.value : target;
    decorators.forEach((decorator) => decorator(targetKey));
  };
}
