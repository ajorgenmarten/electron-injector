import { first, lastValueFrom, Observable } from 'rxjs';
import { Container } from './container';
import { DEV_LOGGER, PROD_LOGGER } from './debugger';
import {
  ControllerIsNotValid,
  DataValidationError,
  ForbiddenAccessError,
  IsNotExceptionFilter,
} from './errors';
import { CONTROLLER, FILTER, GUARD, HANDLER, PARAM } from './keys';
import type {
  CanActivate,
  Class,
  ConfigOptions,
  ExceptionFilter,
  HandlerMetadata,
} from './types';
import { ExecutionContext } from './utilities';
import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import {
  getMetadataStorage,
  validate,
  ValidatorOptions,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

export class Application {
  private container = new Container();
  private filters: Map<Class, Class<ExceptionFilter>> = new Map();

  static create(
    configOptions: ConfigOptions,
    validationOptions: ValidatorOptions = {},
  ) {
    return new Application(configOptions, validationOptions);
  }

  useGlobalFilters(...filters: Class<ExceptionFilter>[]) {
    for (const filter of filters) {
      const exceptionsClasses = Reflect.getMetadata(FILTER, filter);
      if (!exceptionsClasses) throw new IsNotExceptionFilter(filter.name);
      exceptionsClasses.forEach((excls: Class) => {
        this.filters.set(excls, filter);
        this.container.addProvider(filter);
      });
    }
  }

  constructor(
    private configOptions: ConfigOptions,
    private validationOptions: ValidatorOptions,
  ) {
    this.loadProviders();
  }

  private loadProviders() {
    for (const provider of this.configOptions.providers || []) {
      this.container.addProvider(provider);
      DEV_LOGGER(
        `[Electron Injector] Provider ${typeof provider == 'object' ? provider.provided.name : provider.name} loaded`,
      );
    }
  }

  bootstrap() {
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

        const path = this.buildPath(controllerPrefix, handlerMetadata.path);

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
            try {
              const response = await this.guardExecute(guard, executionContext);
              if (!response)
                return {
                  success: false,
                  error: new ForbiddenAccessError(
                    path,
                    guard.constructor.prototype.name,
                  ),
                };
            } catch (e) {
              return await this.useFilter(e, executionContext);
            }
          }

          let params = [];
          try {
            params = await this.getParams(
              controllerInstance,
              controllerMethod,
              executionContext,
            );
          } catch (e) {
            return await this.useFilter(e, executionContext);
          }

          let controllerResult = undefined;

          try {
            controllerResult = await this.controllerExecute(
              controllerInstance,
              controllerInstance[controllerMethod],
              params,
            );
          } catch (e) {
            return await this.useFilter(e, executionContext);
          }

          return controllerResult;
        };

        if (handlerMetadata.type === 'invoke') {
          ipcMain.handle(path, handlerCallback);
        } else {
          ipcMain.on(path, handlerCallback as any);
        }

        DEV_LOGGER(
          `[Electron Injector] Route ${path} has initialized (${handlerMetadata.type === 'invoke' ? 'invoke' : 'send'})`,
        );
      }
    }
  }

  private async getParams(
    target: any,
    propertyKey: string | symbol,
    executionContext: ExecutionContext,
  ) {
    const params = Reflect.getMetadata(PARAM, target, propertyKey) as
      | Array<string | Function>
      | undefined;

    if (!params) return [];
    return await Promise.all(
      params.map(async (param, index) => {
        if (param === 'ctx') return executionContext;

        if (param === 'event') return executionContext.event;

        if (param === 'payload') {
          const validationClass = Reflect.getMetadata(
            'design:paramtypes',
            target,
            propertyKey,
          )[index];

          const metadata = getMetadataStorage().getTargetValidationMetadatas(
            validationClass,
            null!,
            false,
            false,
          );

          if (typeof validationClass == 'function' && metadata.length) {
            const validatorObjectInstance = plainToInstance(
              validationClass,
              executionContext.payload,
            );
            const errors = await validate(
              validatorObjectInstance,
              this.validationOptions,
            );

            if (errors.length) throw new DataValidationError(errors[0]);
          }

          return executionContext.payload;
        }

        if (typeof param === 'function') {
          return param(executionContext);
        }

        return undefined;
      }),
    );
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
  }

  private async controllerExecute(context: any, target: any, params: any[]) {
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
  }

  private async useFilter(error: unknown, executionContext: ExecutionContext) {
    PROD_LOGGER(error);

    for (const [cls, fltr] of this.filters) {
      if (!(error instanceof cls)) continue;

      const filterInstance = this.container.resolve(fltr);

      const response = (filterInstance as ExceptionFilter).catch(
        error,
        executionContext,
      );

      if (response instanceof Promise) {
        return await response;
      }

      if (response instanceof Observable) {
        return await lastValueFrom(response);
      }

      return response;
    }

    return { success: false, error: error };
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
