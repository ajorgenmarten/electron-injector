import { Observable } from 'rxjs';
import { ExecutionContext } from './utilities';

export type Class<T = any> = new (...args: any[]) => T;
export type InjectableType = 'singleton' | 'transient';
export type HandlerMetadata = {
  type: 'invoke' | 'send';
  path: string;
};
export type Provider =
  | Class
  | {
      provided: Class;
      useClass: Class;
    };
export interface CanActivate {
  canActivate: (
    context: ExecutionContext,
  ) => boolean | Promise<boolean> | Observable<boolean>;
}
export interface ConfigOptions {
  providers?: Provider[];
  controllers?: Class[];
}
