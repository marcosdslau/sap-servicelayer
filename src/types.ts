/**
 * Configurações de login para o Service Layer
 */
export interface LoginConfig {
  username: string;
  password: string;
  language?: string;
  timeout?: number;
}

/**
 * Configurações de inicialização do Service Layer
 */
export interface InitConfig {
  database: string;
  username: string;
  password: string;
  url: string;
  language?: string;
  timeout?: number;
}

/**
 * Configurações para execução de requisições
 */
export interface ExecuteConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  header?: Record<string, string>;
  data?: any;
  page?: number;
  size?: number;
  timeout?: number;
}

/**
 * Resposta paginada da execução
 */
export interface PaginatedResponse<T = any> {
  value?: T[];
  previous?: boolean;
  next?: boolean;
  'odata.nextLink'?: string;
  [key: string]: any;
}

/**
 * Operação para batch
 */
export interface BatchOperation {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  header?: Record<string, string>;
  data?: any;
}

/**
 * Configurações para execução de batch
 */
export interface ExecuteBatchConfig {
  transaction?: boolean;
  operations: BatchOperation[];
  header?: Record<string, string>;
  timeout?: number;
}

/**
 * Resposta de uma operação batch
 */
export interface BatchResponse {
  httpCode: string;
  httpStatus: string;
  contentId: string | null;
  json: any;
}

/**
 * Configurações para execução SMLSVC
 */
export interface ExecuteSmlsvcConfig {
  url: string;
  headers?: Record<string, string>;
}

