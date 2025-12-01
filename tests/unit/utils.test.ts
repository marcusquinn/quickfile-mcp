/**
 * Unit tests for tool utilities
 */

import {
  handleToolError,
  successResult,
  errorResult,
  cleanParams,
  logger,
} from '../../src/tools/utils';
import { QuickFileApiError } from '../../src/api/client';

describe('Tool Utilities', () => {
  describe('successResult', () => {
    it('should create a valid success result with object data', () => {
      const data = { id: 1, name: 'Test' };
      const result = successResult(data);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const result = successResult(data);

      expect(result.content[0].text).toBe(JSON.stringify(data, null, 2));
    });

    it('should handle null data', () => {
      const result = successResult(null);

      expect(result.content[0].text).toBe('null');
    });

    it('should handle nested objects', () => {
      const data = {
        client: { id: 1, name: 'Test' },
        invoices: [{ id: 100 }, { id: 101 }],
      };
      const result = successResult(data);

      expect(JSON.parse(result.content[0].text)).toEqual(data);
    });
  });

  describe('errorResult', () => {
    it('should create an error result with message', () => {
      const message = 'Something went wrong';
      const result = errorResult(message);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe(message);
      expect(result.isError).toBe(true);
    });
  });

  describe('handleToolError', () => {
    it('should handle QuickFileApiError with code and message', () => {
      const error = new QuickFileApiError('Client not found', 'CLIENT_404');
      const result = handleToolError(error);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('QuickFile API Error [CLIENT_404]: Client not found');
    });

    it('should handle standard Error', () => {
      const error = new Error('Network timeout');
      const result = handleToolError(error);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: Network timeout');
    });

    it('should handle string errors', () => {
      const result = handleToolError('Something failed');

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: Unknown error');
    });

    it('should handle null/undefined errors', () => {
      const result = handleToolError(null);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: Unknown error');
    });

    it('should handle object errors without message', () => {
      const result = handleToolError({ code: 500 });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: Unknown error');
    });
  });

  describe('cleanParams', () => {
    it('should remove undefined values', () => {
      const params = {
        name: 'Test',
        email: undefined,
        age: 25,
        address: undefined,
      };
      const result = cleanParams(params);

      expect(result).toEqual({ name: 'Test', age: 25 });
    });

    it('should keep null values', () => {
      const params = {
        name: 'Test',
        email: null,
      };
      const result = cleanParams(params);

      expect(result).toEqual({ name: 'Test', email: null });
    });

    it('should keep empty strings', () => {
      const params = {
        name: 'Test',
        description: '',
      };
      const result = cleanParams(params);

      expect(result).toEqual({ name: 'Test', description: '' });
    });

    it('should keep zero values', () => {
      const params = {
        count: 0,
        offset: undefined,
      };
      const result = cleanParams(params);

      expect(result).toEqual({ count: 0 });
    });

    it('should keep false values', () => {
      const params = {
        active: false,
        deleted: undefined,
      };
      const result = cleanParams(params);

      expect(result).toEqual({ active: false });
    });

    it('should handle empty object', () => {
      const result = cleanParams({});

      expect(result).toEqual({});
    });

    it('should handle object with all undefined', () => {
      const params = {
        a: undefined,
        b: undefined,
      };
      const result = cleanParams(params);

      expect(result).toEqual({});
    });
  });

  describe('logger', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      delete process.env.QUICKFILE_DEBUG;
    });

    it('should log info messages', () => {
      logger.info('Test message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[INFO] Test message');
    });

    it('should log info messages with context', () => {
      logger.info('Test message', { id: 1 });

      expect(consoleErrorSpy).toHaveBeenCalledWith('[INFO] Test message {"id":1}');
    });

    it('should log warn messages', () => {
      logger.warn('Warning message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[WARN] Warning message');
    });

    it('should log error messages', () => {
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error message');
    });

    it('should not log debug messages by default', () => {
      logger.debug('Debug message');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages when QUICKFILE_DEBUG is set', () => {
      process.env.QUICKFILE_DEBUG = 'true';
      logger.debug('Debug message');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG] Debug message');
    });

    it('should log debug messages with context when QUICKFILE_DEBUG is set', () => {
      process.env.QUICKFILE_DEBUG = '1';
      logger.debug('Debug message', { data: 'test' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('[DEBUG] Debug message {"data":"test"}');
    });
  });
});
