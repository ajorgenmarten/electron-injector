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
