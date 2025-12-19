import {
  CircularDependency,
  ProviderIsNotInjectable,
  ProviderNotFound,
} from './errors';
import { INJECTABLE } from './keys';
import type { Class, InjectableType, Provider } from './types';
import { Reflector } from './utilities';

export class Container {
  private utilities: Array<Class> = [Reflector];
  private providers: Map<Class, Provider> = new Map();
  private instances: Map<Class, any> = new Map();

  addProvider(provider: Provider) {
    const token = this.getProviderToken(provider);
    this.providers.set(token, provider);
  }

  private getDependencies(providerClass: Class): any[] {
    return Reflect.getMetadata('design:paramtypes', providerClass) ?? [];
  }

  resolve(token: Class, visited: Class[] = []): any {
    const utilitie = this.utilities.find((u) => u === token);
    if (utilitie) return new utilitie();

    const singletonInstance = this.instances.get(token);
    if (singletonInstance) return singletonInstance;

    const provider = this.providers.get(token);
    if (!provider) throw new ProviderNotFound(token.name);

    if (visited.includes(token)) throw new CircularDependency(token.name);

    const providerClass = this.getProviderClass(provider);
    const providerDependencies = this.getDependencies(providerClass);
    const providerMetadata = this.getProviderMetadata(providerClass);

    const instanceDependencies = providerDependencies.map((dep) =>
      this.resolve(dep, [...visited, token]),
    );

    if (!providerMetadata) throw new ProviderIsNotInjectable(token.name);

    const providerInstance = new providerClass(...instanceDependencies);

    if (providerMetadata === 'singleton')
      this.instances.set(token, providerInstance);

    return providerInstance;
  }

  private getProviderToken(provider: Provider): Class {
    return typeof provider === 'object' ? provider.provided : provider;
  }

  private getProviderClass(provider: Provider): Class {
    return typeof provider === 'object' ? provider.useClass : provider;
  }

  private getProviderMetadata(provider: Class): InjectableType | undefined {
    return Reflect.getMetadata(INJECTABLE, provider);
  }
}
