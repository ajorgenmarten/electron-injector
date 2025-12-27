import { ValidationError } from 'class-validator';

export class ElectronInjectorError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ProviderNotFound extends ElectronInjectorError {
  constructor(providerName: string) {
    super(`Provider '${providerName}' not found`);
  }
}

export class IsNotExceptionFilter extends ElectronInjectorError {
  constructor(filterName: string) {
    super(
      `Class ${filterName} is not a filter. Please ensure it is decorated with @Catch(...filters)`,
    );
  }
}

export class CircularDependency extends ElectronInjectorError {
  constructor(providerName: string) {
    super(`Circular dependency detected for provider '${providerName}'`);
  }
}

export class ProviderIsNotInjectable extends ElectronInjectorError {
  constructor(providerName: string) {
    super(
      `Provider '${providerName}' is not injectable. Please ensure it is decorated with @Injectable()`,
    );
  }
}

export class ControllerIsNotValid extends ElectronInjectorError {
  constructor(controllerName: string) {
    super(
      `Controller '${controllerName}' is not valid. Please ensure it is decorated with @Controller()`,
    );
  }
}

export class DataValidationError {
  private messages;

  constructor(validationError: ValidationError) {
    this.messages = validationError.constraints;
  }

  get Messages() {
    return this.messages;
  }
}

export class ForbiddenAccessError extends ElectronInjectorError {
  constructor(path: string, guardName: string) {
    super(`Can not access to "${path}" path, by the gaurd "${guardName}"`);
  }
}
