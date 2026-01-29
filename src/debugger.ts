import debug from 'debug';

const prodLogger = debug('app:prod');
const devLogger = debug('app:dev');

if (process.env.APP_LOGGER && process.env.APP_LOGGER.toLowerCase() === 'true')
  debug.enable('app:prod');
else debug.enable('app:*');

/**
 * Este logger funciona este o no este definido la variable de entorno APP_LOGGER
 */
export const PROD_LOGGER = prodLogger;
/**
 * Este logger solo funciona si esta definida la variable de entorno APP_LOGGER
 */
export const DEV_LOGGER = devLogger;
