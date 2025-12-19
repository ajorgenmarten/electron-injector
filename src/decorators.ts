import { CONTROLLER, GUARD, HANDLER, INJECTABLE, PARAM } from './keys';
import { CanActivate, Class, InjectableType } from './types';

type ParamMetadataType = 'payload' | 'event' | 'ctx';

export function Controller(path: string = ''): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(CONTROLLER, path, target);
  };
}

export function Injectable(type: InjectableType = 'singleton'): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(INJECTABLE, type, target);
  };
}

export function OnSend(path: string = ''): MethodDecorator {
  return function (_target, _property, descriptor) {
    Reflect.defineMetadata(
      HANDLER,
      { path, type: 'send' },
      descriptor.value as CallableFunction,
    );
  };
}

export function OnInvoke(path: string = ''): MethodDecorator {
  return function (_target, _property, descriptor) {
    Reflect.defineMetadata(
      HANDLER,
      { path, type: 'invoke' },
      descriptor.value as CallableFunction,
    );
  };
}

function _getParams(
  target: any,
  property: string | symbol,
): Array<ParamMetadataType> {
  const prevParams = Reflect.getMetadata(PARAM, target, property);
  return prevParams ?? [];
}

function _getGuards(target: any): any[] {
  const prevGuards = Reflect.getMetadata(GUARD, target);
  return prevGuards ?? [];
}

export function Payload(): ParameterDecorator {
  return function (target, property, paramIndex) {
    const params = _getParams(target, property as string | symbol);
    params[paramIndex] = 'payload';
    Reflect.defineMetadata(PARAM, params, target, property as string | symbol);
  };
}

export function Event(): ParameterDecorator {
  return function (target, property, paramIndex) {
    const params = _getParams(target, property as string | symbol);
    params[paramIndex] = 'event';
    Reflect.defineMetadata(PARAM, params, target, property as string | symbol);
  };
}

export function Ctx(): ParameterDecorator {
  return function (target, property, paramIndex) {
    const params = _getParams(target, property as string | symbol);
    params[paramIndex] = 'ctx';
    Reflect.defineMetadata(PARAM, params, target, property as string | symbol);
  };
}

export function UseGuards(...guards: Class<CanActivate>[]) {
  return function (
    _target: Object,
    _property?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    const target = descriptor ? descriptor.value : _target;
    const prevGuards = _getGuards(target).filter(
      (prevGuard) => !guards.includes(prevGuard),
    );
    Reflect.defineMetadata(GUARD, [...guards, ...prevGuards], target);
  };
}

export function SetMetadata(key: any, value: any) {
  return function (
    target: Object,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    const targetKey = descriptor ? descriptor.value : target;
    Reflect.defineMetadata(key, value, targetKey);
  };
}
