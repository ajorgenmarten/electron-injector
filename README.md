# Librería Electron Injector

*electron-injector* es una librería diseñada para simplificar y robustecer el desarrollo de aplicaciones con Electron y TypeScript. Ofrece un sistema de Inyección de Dependencias (DI) e Inversión de Control (IoC) que promueve un código más mantenible, testeable y claro, mejorando tanto la experiencia del desarrollador como la calidad final del software.

Nace de la necesidad de crear aplicaciones de escritorio multiplataforma donde no solo importa la experiencia de usuario (UX), sino también una experiencia de desarrollo (DX) ágil y bien estructurada.

## ✨ ¿Por qué electron-injector?
Electron es poderoso pero su arquitectura multi-proceso puede volverse caótica rápidamente. electron-injector resuelve esto proporcionando:

✅ Arquitectura limpia - Separación clara de responsabilidades

✅ Código mantenible - DI/IoC para un acoplamiento reducido

✅ Testing simplificado - Servicios fácilmente mockeables

✅ Comunicación IPC tipada - Seguridad en tiempo de compilación

✅ Experiencia NestJS-like - Sintaxis familiar para full-stack developers


## 🚀 Características

### Core
- Sistema de Inyección de Dependencias completo con contenedor IoC

- Decoradores inspirados en NestJS para IPC (@OnSend, @OnInvoke)

- Gestión automática de handlers de Electron IPC

- Tipado TypeScript completo con inferencia automática

### Seguridad & Validación
- Guards para autorización y validación

- Integración con class-validator para DTOs tipados

- Metadata reflection para parametrización avanzada

### Rendimiento & Control
- Control de ciclo de vida (singleton/transient)

- Detección de dependencias circulares

- Sistema de logging diferenciado (dev/prod)

- Soporte para RxJS en guards y handlers


## 📦 Instalación
```bash
npm install electron-injector rxjs class-validator class-transformer
```
### Configuración TypeScript
Asegúrate de habilitar estos flags en tu tsconfig.json:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

> **Nota:**  
> Si estás usando Vite, también debes instalar `@swc/core` y configurar el plugin correspondiente en tu archivo de configuración de Vite:
>
> ```bash
> npm install @swc/core --save-dev
> ```
>
> Luego, agrega el plugin de SWC en tu `vite.config.js` o `vite.config.ts` según la documentación de Vite y el plugin que utilices.

## 🎯 Empezando Rápido
```ts
// main.ts
import 'reflect-metadata';
import { app, BrowserWindow } from 'electron';
import { Application } from 'electron-injector';
import { UserController } from './controllers/user.controller';
import { AuthGuard } from './guards/auth.guard';
import { UserService } from './services/user.service';
import { DtoFilter } from './filters/dto.filter';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      partition: 'persist:your-app'
    }
  })
  
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() {
  const application = Application.create({
    providers: [UserService, AuthGuard],
    controllers: [UserController]
  })

  application.useGlobalFilters(DtoFilter)

  application.bootstrap()

  createWindow()
})
```

## 2. Creando un servicio
```ts
// services/user.service.ts
import { Injectable } from 'electron-injector';

export interface User {
  id: string;
  name: string;
  email: string;
}

@Injectable() // Por defecto es singleton
export class UserService {
  private users: User[] = [];

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const newUser = {
      ...user,
      id: Date.now().toString(),
    };
    this.users.push(newUser);
    return newUser;
  }

  async findAll(): Promise<User[]> {
    return [...this.users];
  }

  async findById(id: string): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }
}
```
## 3. Creando un controlador IPC
```ts
// controllers/user.controller.ts
import { Controller, OnInvoke, OnSend, Payload, Event } from 'electron-injector';
import { UserService } from '../services/user.service';
import { IpcMainEvent } from 'electron';

@Controller('user') // Prefijo para todos los handlers
export class UserController {
  constructor(private userService: UserService) {}

  // Handler para ipcMain.handle
  @OnInvoke('create')
  async createUser(@Payload() userData: any) {
    return await this.userService.createUser(userData);
  }

  // Handler para ipcMain.on
  @OnSend('updated')
  onUserUpdated(@Payload() data: any, @Event() event: IpcMainEvent) {
    console.log('User updated:', data);
    // Puedes enviar respuestas o realizar otras acciones
    return { success: true, timestamp: Date.now() };
  }

  // Handler con nombre del método como path
  @OnInvoke()
  async findAll() {
    return await this.userService.findAll();
  }
}
```

## 4. Creando un Guard
```ts
// guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from 'electron-injector';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const payload = context.payload;
    const event = context.event;
    
    // Lógica de autorización aquí
    const token = payload?.token || event.sender.session.cookies.get({ name: 'auth_token' });
    
    return !!token; // Ejemplo simple
  }
}

// Guard con RxJS
@Injectable()
export class AsyncGuard implements CanActivate {
  canActivate(context: ExecutionContext): Observable<boolean> {
    return of(true).pipe(delay(100)); // Ejemplo asíncrono
  }
}
```

# 📖 Decoradores disponibles
## Decoradores de clase

` @Controller(path?: string) `

Marca una clase como controlador de IPC. Todos los handlers dentro de esta clase usarán el prefijo especificado.
```ts
@Controller('auth') // Todos los handlers empezarán con 'auth:'
export class AuthController {}
```

` @Injectable(type?: 'singleton' | 'transient') `

Marca una clase como disponible para inyección de dependencias.
```ts
@Injectable() // Por defecto singleton
export class DatabaseService {}

@Injectable('transient') // Nueva instancia cada vez que se inyecta en una clase
export class RequestScopedService {}
```

## Decoradores de métodos

` @OnInvoke(path?: string) `

Crea un handler para `ipcMain.handle`. Responde a invocaciones del renderer.
```ts
@OnInvoke('get-data') // Responde a 'controller-prefix:get-data'
async getData() {
  return { data: 'value' };
}
````

` @OnSend(path?: string) `

Crea un handler para `ipcMain.on`. Escucha eventos del renderer.
```ts
@OnSend('message') // Escucha 'controller-prefix:message'
onMessage(@Payload() data: any) {
  console.log('Received:', data);
}
```

## Decoradores de parámetros

` @Payload() `

Inyecta el payload recibido desde el renderer. Si defines como tipo una clase decorada con class-validator, esto realiza la validación automática.
```ts
@OnInvoke('update')
async update(@Payload() data: any) {
  // 'data' contiene el payload enviado desde el renderer
}
```

` @Event() `

Inyecta el objeto `IpcMainEvent` o `IpcMainInvokeEvent`.
```ts
@OnSend('action')
onAction(@Payload() data: any, @Event() event: IpcMainEvent) {
  event.sender.send('response', { received: true });
}
```

` @Ctx() `

Inyecta el `ExecutionContext` completo.
```ts
@OnInvoke('process')
async process(@Ctx() context: ExecutionContext) {
  const { payload, event, getHandler, getClass } = context;
  // Acceso completo al contexto
}
```

## Decoradores de Metadata y Guards

` @UseGuards(...guards) `

Aplica guards a un controlador o método específico.
```ts
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard) // Aplica a todos los métodos
export class AdminController {
  
  @OnInvoke('sensitive')
  @UseGuards(ExtraSecurityGuard) // Guard adicional para este método
  async sensitiveOperation() {
    // Solo accesible si todos los guards retornan true
  }
}
```

` @SetMetadata(key, value) `

Establece metadata personalizada en controladores o métodos.
```ts
@Controller('user')
@SetMetadata('roles', ['admin', 'user'])
export class UserController {
  
  @OnInvoke('delete')
  @SetMetadata('requiresAdmin', true)
  async deleteUser() {
    // Método con metadata personalizada
  }
}
```
