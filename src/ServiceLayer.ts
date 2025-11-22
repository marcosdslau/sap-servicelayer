import axios, { AxiosError, AxiosResponse } from 'axios';
import https from 'https';
import {
  ServiceLayerConfig,
  ExecuteConfig,
  RequestConfig,
  ExecuteBatchConfig,
  ExecuteSmlsvcConfig,
  PaginatedResponse,
  BatchResponse,
} from './types';

/**
 * Agent HTTPS que permite certificados auto-assinados
 */
const agent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * Classe para integração com SAP Service Layer
 */
export class ServiceLayer {
  private cookie: string = '';
  private routerId: string = '';
  private database: string;
  private username: string;
  private password: string;
  private url: string;
  private language: string;
  private timeout: number;
  private retries: number = 0;

  /**
   * Construtor da classe ServiceLayer
   * @param config Configurações do Service Layer
   */
  constructor(config: ServiceLayerConfig) {
    this.database = config.database;
    this.url = config.url;
    this.username = config.username;
    this.password = config.password;
    this.language = config.language || '29';
    this.timeout = config.timeout || 0;
  }

  /**
   * Realiza login no Service Layer
   */
  async login(): Promise<void> {
    const me = this;

    async function execute(retries: number = 0): Promise<void> {
      me.routerId = '';
      me.cookie = ''; // Quando mandamos o cookie antigo no login, ocorre um erro na SL. Erro: name.toLowerCase is not a function

      const urlParse = `${me.url}/Login`;

      let response: AxiosResponse;
      try {
        response = await axios.post(
          urlParse,
          {
            CompanyDB: me.database,
            UserName: me.username,
            Password: me.password,
            Language: me.language,
          },
          {
            httpsAgent: agent,
            timeout: me.timeout,
          }
        );
      } catch (ex) {
        const error = ex as AxiosError;
        if (!error.response) {
          error.response = {} as AxiosResponse;
        }

        if (!error.response || !error.response.status) {
          throw error;
        }

        switch (error.response.status) {
          case 502:
            console.log(`Nova tentativa, erro 502. ${retries}`);
            if (retries < 5) {
              return await execute(++retries);
            } else {
              throw error;
            }
          default:
            throw error;
        }
      }

      const headerCookie = response.headers['set-cookie'];
      if (headerCookie) {
        headerCookie.forEach((cookie) => {
          const [key, value] = cookie.split('=');

          if (cookie.indexOf('ROUTEID') > -1) {
            me.routerId += `${key}=${value}`;
          } else {
            me.cookie += `${key}=${value}`;
          }
        });
      }
    }

    return await execute();
  }

  /**
   * Realiza logout do Service Layer
   * Nota: Deve ser feito no lado do cliente apenas apagando o token recebido no login
   */
  async logout(): Promise<void> {
    // Implementação deve ser feita no lado do cliente
    this.cookie = '';
    this.routerId = '';
  }

  /**
   * Executa uma requisição no Service Layer (método privado)
   * @param config Configurações da requisição
   * @returns Dados da resposta
   */
  private async execute<T = any>(config: ExecuteConfig): Promise<PaginatedResponse<T>> {
    const executeRequest = async (retries: number = 0): Promise<PaginatedResponse<T>> => {
      const customHeaders: Record<string, string> = {
        Cookie: this.cookie,
      };

      if (config.header) {
        for (const prop in config.header) {
          customHeaders[prop] = config.header[prop];
        }
      }

      if (config.size) {
        customHeaders['Prefer'] = `odata.maxpagesize=${config.size}`;
      }

      let info = '';

      if (config.page !== undefined && config.page !== null) {
        const skipPage = (config.page || 0) * (config.size || 20);
        const idx = config.url.indexOf('?');
        info = (idx >= 0 ? '&' : '?') + `$skip=${skipPage}`;
      }

      const newUrl = `${this.url}/${config.url}${info}`;
      let response: AxiosResponse<PaginatedResponse<T>>;

      try {
        response = await axios({
          method: config.method,
          url: newUrl,
          httpsAgent: agent,
          headers: customHeaders,
          data: config.data ? JSON.stringify(config.data) : null,
          timeout: config.timeout || 0,
        });
      } catch (ex) {
        const error = ex as AxiosError;
        if (!error.response) {
          error.response = {} as AxiosResponse;
        }

        if (!error.response || !error.response.status) {
          throw error;
        }

        switch (error.response.status) {
          case 401:
            console.log(`Reconectando na service layer. ${retries}`);
            await this.login();
            if (retries < 5) {
              return await executeRequest(++retries);
            } else {
              throw error;
            }
          case 502:
            console.log(`Nova tentativa, erro 502. ${retries}`);
            if (retries < 5) {
              return await executeRequest(++retries);
            } else {
              throw error;
            }
          default:
            throw error;
        }
      }

      const responseData = response.data;

      if (config.page !== undefined && config.page !== null) {
        responseData.previous = config.page > 0;
        responseData.next = responseData['odata.nextLink'] !== undefined;
      }

      return responseData;
    };

    return await executeRequest();
  }

  /**
   * Gera um GUID único
   */
  private generateGuid(): string {
    const S4 = (): string => {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return (
      S4() +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      S4() +
      S4()
    );
  }

  /**
   * Cria headers formatados para batch
   */
  private createHeader(header: Record<string, string>): string {
    let data = '';
    for (const prop in header) {
      data += `${prop}: ${header[prop]}\n`;
    }
    return data;
  }

  /**
   * Obtém a versão do Service Layer da URL
   */
  private getVersionSL(fullUrl: string): string {
    const match = fullUrl.match(/\/b1s\/v[0-9]+/);
    const basePath = match ? match[0] : '/b1s/v1';
    return basePath.endsWith('/') ? basePath : `${basePath}/`;
  }

  /**
   * Executa operações em batch
   * @param config Configurações do batch
   * @returns Array de respostas das operações
   */
  async executeBatch(config: ExecuteBatchConfig): Promise<BatchResponse[]> {
    const executeBatchRequest = async (retries: number = 0): Promise<BatchResponse[]> => {
      const batchBoundary = 'batch_' + this.generateGuid();
      const changeSetBoundary = config.transaction ? 'changeset_' + this.generateGuid() : '';
      const customHeaders: Record<string, string> = {
        Cookie: this.cookie,
        'Content-Type': `multipart/mixed;boundary=${batchBoundary}`,
        'OData-Version': '4.0',
      };

      if (config.header) {
        for (const prop in config.header) {
          customHeaders[prop] = config.header[prop];
        }
      }

      const url = `${this.url}/$batch`;
      const versionSL = this.getVersionSL(this.url);

      let data = '';
      for (let i = 0; i < config.operations.length; i++) {
        const operation = config.operations[i];
        if (i === 0 && config.transaction) {
          data += `--${batchBoundary}\n`;
          data += `Content-Type: multipart/mixed;boundary=${changeSetBoundary}\n`;
        }
        if (config.transaction) {
          data += `--${changeSetBoundary}\n`;
        } else {
          data += `--${batchBoundary}\n`;
        }
        data += 'Content-Type: application/http\n';
        data += 'Content-Transfer-Encoding:binary\n';
        data += `Content-ID: ${i + 1}\n\n`;
        data += `${operation.method} ${versionSL}${operation.url}\n`;
        data += this.createHeader(operation.header || {});
        data += '\n';

        if (operation.data) {
          data += JSON.stringify(operation.data) + '\n\n';
        }
      }
      if (config.transaction) {
        data += `--${changeSetBoundary}--\n`;
      }
      data += `--${batchBoundary}--\n`;

      let response: AxiosResponse<string>;
      try {
        response = await axios({
          method: 'post',
          url,
          httpsAgent: agent,
          headers: customHeaders,
          data,
          timeout: config.timeout || 0,
        });
      } catch (ex) {
        const error = ex as AxiosError;
        if (!error.response) {
          error.response = {} as AxiosResponse;
        }

        if (!error.response || !error.response.status) {
          throw error;
        }

        switch (error.response.status) {
          case 401:
            console.log(`Reconectando na service layer. ${retries}`);
            await this.login();
            if (retries < 5) {
              return await executeBatchRequest(++retries);
            } else {
              throw error;
            }
          case 502:
            console.log(`Nova tentativa, erro 502. ${retries}`);
            if (retries < 5) {
              return await executeBatchRequest(++retries);
            } else {
              throw error;
            }
          default:
            throw error;
        }
      }

      const responseArray: BatchResponse[] = [];
      const responseLines = response.data.split(/\r?\n/);
      const boundaryRex = response.data.match(/\n--changesetresponse/)
        ? new RegExp('^--changesetresponse')
        : new RegExp('^--batchresponse');
      let seekStatus: 'init' | 'response' | 'json' = 'init';
      let contentId: string | null = null;
      let httpCode: string | null = null;
      let httpStatus: string | null = null;
      let json: any = null;
      let jsonStr = '';

      for (let i = 0; i < responseLines.length; i++) {
        const line = responseLines[i];
        if (seekStatus === 'init') {
          if (!line.match(boundaryRex)) {
            continue;
          } else {
            seekStatus = 'response';
            continue;
          }
        } else {
          if (line.match(boundaryRex)) {
            const responseItem: BatchResponse = {
              httpCode: httpCode || '',
              httpStatus: httpStatus || '',
              contentId,
              json,
            };
            responseArray.push(responseItem);
            contentId = null;
            httpCode = null;
            httpStatus = null;
            json = null;
            jsonStr = '';
            seekStatus = 'response';
            continue;
          }
        }
        if (seekStatus === 'response') {
          let m = line.match(/^Content-ID: (\d+)$/);
          if (m) {
            contentId = m[1];
            continue;
          }
          m = line.match(/^HTTP\/\d\.\d (\d+) (.+)$/);
          if (m) {
            httpCode = m[1];
            httpStatus = m[2];
            continue;
          }
          if (line.match(/^{$/)) {
            jsonStr += '{\n';
            seekStatus = 'json';
            continue;
          }
        }
        if (seekStatus === 'json') {
          jsonStr += line + '\n';
          if (line.match(/^}$/)) {
            json = JSON.parse(jsonStr);
          }
        }
      }

      return responseArray;
    };

    return await executeBatchRequest();
  }

  /**
   * Executa requisições SMLSVC
   * @param config Configurações da requisição SMLSVC
   * @returns Dados da resposta
   */
  async executeSmlsvc<T = any>(config: ExecuteSmlsvcConfig): Promise<T> {
    const executeRequest = async (retries: number = 0): Promise<T> => {
      this.retries = retries;
      const customHeaders: Record<string, string> = {
        Cookie: this.cookie,
      };

      if (config.headers) {
        for (const prop in config.headers) {
          customHeaders[prop] = config.headers[prop];
        }
      }

      const newUrl = `${this.url}/${config.url}`;

      try {
        const response = await axios.get<T>(newUrl, {
          httpsAgent: agent,
          headers: customHeaders,
          timeout: 0,
        });
        return response.data;
      } catch (ex) {
        const error = ex as AxiosError;
        if (!error.response) {
          error.response = {} as AxiosResponse;
        }

        if (!error.response || !error.response.status) {
          throw error;
        }

        switch (error.response.status) {
          case 401:
            console.log(`Reconectando na service layer. ${retries}`);
            await this.login();
            if (retries < 5) {
              return await executeRequest(++retries);
            } else {
              throw error;
            }
          case 502:
            console.log(`Nova tentativa, erro 502. ${retries}`);
            if (retries < 5) {
              return await executeRequest(++retries);
            } else {
              throw error;
            }
          default:
            throw error;
        }
      }
    };

    return await executeRequest();
  }

  /**
   * Executa uma requisição GET
   * @param config Configurações da requisição
   * @returns Dados da resposta
   */
  async get<T = any>(config: RequestConfig): Promise<PaginatedResponse<T>> {
    return this.execute<T>({
      url: config.url,
      method: 'GET',
      header: config.header,
      page: config.page,
      size: config.size,
      timeout: config.timeout,
    });
  }

  /**
   * Executa uma requisição POST
   * @param config Configurações da requisição
   * @returns Dados da resposta
   */
  async post<T = any>(config: RequestConfig): Promise<PaginatedResponse<T>> {
    return this.execute<T>({
      url: config.url,
      method: 'POST',
      header: config.header,
      data: config.data,
      timeout: config.timeout,
    });
  }

  /**
   * Executa uma requisição PUT
   * @param config Configurações da requisição
   * @returns Dados da resposta
   */
  async put<T = any>(config: RequestConfig): Promise<PaginatedResponse<T>> {
    return this.execute<T>({
      url: config.url,
      method: 'PUT',
      header: config.header,
      data: config.data,
      timeout: config.timeout,
    });
  }

  /**
   * Executa uma requisição PATCH
   * @param config Configurações da requisição
   * @returns Dados da resposta
   */
  async patch<T = any>(config: RequestConfig): Promise<PaginatedResponse<T>> {
    return this.execute<T>({
      url: config.url,
      method: 'PATCH',
      header: config.header,
      data: config.data,
      timeout: config.timeout,
    });
  }

  /**
   * Executa uma requisição DELETE
   * @param config Configurações da requisição
   * @returns Dados da resposta
   */
  async delete<T = any>(config: RequestConfig): Promise<PaginatedResponse<T>> {
    return this.execute<T>({
      url: config.url,
      method: 'DELETE',
      header: config.header,
      timeout: config.timeout,
    });
  }
}

