import { first, lastValueFrom, Observable } from 'rxjs';
import { Container } from './container';
import { DEV_LOGGER, PROD_LOGGER } from './debugger';
import { ControllerIsNotValid } from './errors';
import { CONTROLLER, GUARD, HANDLER, PARAM } from './keys';
import type { CanActivate, ConfigOptions, HandlerMetadata } from './types';
import { ExecutionContext } from './utilities';
import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';

export class Application {
  private container = new Container();

  static create(configOptions: ConfigOptions) {
    return new Application(configOptions);
  }

  constructor(private configOptions: ConfigOptions) {
    this.loadProviders();
    this.loadControllers();
  }

  private loadProviders() {
    for (const provider of this.configOptions.providers || []) {
      this.container.addProvider(provider);
      DEV_LOGGER(
        `Provider ${typeof provider == 'object' ? provider.provided.name : provider.name} loaded`,
      );
    }
  }

  private loadControllers() {
    for (const controller of this.configOptions.controllers || []) {
      const controllerPrefix = this.getControllerPrefix(controller);
      const controllerDependencies = this.getControllerDependencies(
        controller,
      ) as any[];
      const controllerGuards = this.getGuards(controller);

      const controllerInstance = new controller(
        ...controllerDependencies.map((dep) => this.container.resolve(dep)),
      );
      const controllerMethods = Object.getOwnPropertyNames(
        controllerInstance.constructor.prototype,
      ).filter((method) => method !== 'constructor');

      for (const controllerMethod of controllerMethods) {
        // 1. Obtener la metadata del handler
        const handlerMetadata = this.getHandlerMetadata(
          controllerInstance[controllerMethod],
        );
        if (typeof handlerMetadata !== 'object') continue;

        // 2. Obtener los guards del handler
        const handlerGuards = this.getGuards(
          controllerInstance[controllerMethod],
        );

        const guards = controllerGuards
          .filter((guard) => !handlerGuards.includes(guard))
          .concat(handlerGuards)
          .map((guard) => this.container.resolve(guard));

        const path = this.buildPath(controllerPrefix, controllerMethod);

        const handlerCallback = async (
          event: IpcMainEvent | IpcMainInvokeEvent,
          data: any,
        ) => {
          const executionContext = new ExecutionContext(
            controller,
            controllerInstance[controllerMethod],
            data,
            event,
          );

          for (const guard of guards) {
            const response = await this.guardExecute(guard, executionContext);
            if (!response) return false;
          }

          const params = this.getParams(
            controllerInstance,
            controllerMethod,
            executionContext,
          );

          const controllerResult = await this.controllerExecute(
            controllerInstance,
            controllerInstance[controllerMethod],
            params,
          );

          return controllerResult;
        };

        if (handlerMetadata.type === 'invoke') {
          ipcMain.handle(path, handlerCallback);
        } else {
          ipcMain.on(path, handlerCallback as any);
        }
      }
    }
  }

  private getParams(
    target: any,
    propertyKey: string | symbol,
    executionContext: ExecutionContext,
  ) {
    const params = Reflect.getMetadata(PARAM, target, propertyKey) as
      | Array<string>
      | undefined;

    if (!params) return [];
    return params.map((param) => {
      if (param === 'ctx') return executionContext;

      if (param === 'event') return executionContext.event;

      if (param === 'payload') return executionContext.payload;

      return undefined;
    });
  }

  private buildPath(controllerPrefix: string, methodPath: string) {
    const prefix = controllerPrefix.trim();
    const path = methodPath.trim();
    if (prefix && path) return `${prefix}:${path}`;
    if (prefix) return prefix;
    if (path) return path;
    return '';
  }

  private async guardExecute(
    guard: CanActivate,
    executionContext: ExecutionContext,
  ) {
    try {
      const guardResult = guard.canActivate(executionContext);
      if (guardResult instanceof Observable) {
        const result = await lastValueFrom(guardResult.pipe(first()));
        if (!result) return false;
      } else if (guardResult instanceof Promise) {
        const result = await guardResult;
        if (!result) return false;
      } else {
        if (!guardResult) return false;
      }

      return true;
    } catch (error) {
      PROD_LOGGER(error);
      return false;
    }
  }

  private async controllerExecute(context: any, target: any, params: any[]) {
    try {
      const boundedTarget = target.bind(context);
      let controllerResult = boundedTarget(...params);

      while (
        controllerResult instanceof Observable ||
        controllerResult instanceof Promise
      ) {
        if (controllerResult instanceof Observable) {
          controllerResult = await lastValueFrom(controllerResult);
        } else if (controllerResult instanceof Promise) {
          controllerResult = await controllerResult;
        }
      }

      return controllerResult;
    } catch (error) {
      PROD_LOGGER((error as any).message ?? error);
      return undefined;
    }
  }

  private getHandlerMetadata(target: any): HandlerMetadata | undefined {
    const handlerMetadata = Reflect.getMetadata(HANDLER, target);
    return handlerMetadata ?? {};
  }

  private getGuards(target: any): any[] {
    const guards = Reflect.getMetadata(GUARD, target);
    return guards ?? [];
  }

  private getControllerPrefix(target: any) {
    const prefix = Reflect.getMetadata(CONTROLLER, target);
    if (typeof prefix !== 'string') throw new ControllerIsNotValid(target.name);
    return prefix;
  }

  private getControllerDependencies(target: any) {
    const deps = Reflect.getMetadata('design:paramtypes', target);
    return deps ?? [];
  }
}
