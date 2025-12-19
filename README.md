# Librería Electron Injector

*electron-injector* es una librería diseñada para simplificar y robustecer el desarrollo de aplicaciones con Electron y TypeScript. Ofrece un sistema de Inyección de Dependencias (DI) e Inversión de Control (IoC) que promueve un código más mantenible, testeable y claro, mejorando tanto la experiencia del desarrollador como la calidad final del software.

Nace de la necesidad de crear aplicaciones de escritorio multiplataforma donde no solo importa la experiencia de usuario (UX), sino también una experiencia de desarrollo (DX) ágil y bien estructurada.

## ✨ Características
✅ Sistema de Inyección de Dependencias completo con contenedor IoC

✅ Decoradores para IPC (@OnSend, @OnInvoke) inspirados en NestJS

✅ Gestión automática de handlers de Electron IPC

✅ Soporte para Guards (autorización y validación)

✅ Metadata reflection para parametrización avanzada

✅ Soporte para RxJS (Observables) en guards y handlers

✅ Control de ciclo de vida (singleton/transient)

✅ Sistema de logging diferenciado (desarrollo/producción)

✅ Detección de dependencias circulares

✅ Tipado TypeScript completo

## 📦 Instalación
```bash
npm install electron-injector rxjs
```

> **Nota:**  
> Si estás usando Vite, también debes instalar `@swc/core` y configurar el plugin correspondiente en tu archivo de configuración de Vite:
>
> ```bash
> npm install @swc/core --save-dev
> ```
>
> Luego, agrega el plugin de SWC en tu `vite.config.js` o `vite.config.ts` según la documentación de Vite y el plugin que utilices.

## 2. Configuración Principal
```ts
// main.ts
import 'reflect-metadata';
import { app, BrowserWindow } from 'electron';
import { Application } from 'electron-di';
import { UserController } from './controllers/user.controller';
import { AuthGuard } from './guards/auth.guard';
import { UserService } from './services/user.service';

async function bootstrap() {
  const electronApp = new Application({
    providers: [
      UserService,
      AuthGuard,
    ],
    controllers: [
      UserController,
    ],
  });

  await app.whenReady();
  
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');
}

bootstrap().catch(console.error);
```
