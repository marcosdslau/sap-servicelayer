# sap-servicelayer

Biblioteca TypeScript para integração com SAP Service Layer API. Esta biblioteca fornece uma interface simples e tipada para interagir com o SAP Business One Service Layer.

## Instalação

```bash
npm install sap-servicelayer
```

## Uso Básico

```typescript
import { ServiceLayer } from 'sap-servicelayer';

// Criar instância com todas as configurações
const serviceLayer = new ServiceLayer({
  database: 'SBODEMOUS',
  url: 'https://localhost:50000/b1s/v1',
  username: 'manager',
  password: '1234',
  language: '29', // opcional, padrão: '29'
  timeout: 0 // opcional, padrão: 0
});

// Fazer login (sem parâmetros, usa as configurações do construtor)
await serviceLayer.login();

// Executar uma requisição GET usando método auxiliar
const customers = await serviceLayer.get({
  url: 'BusinessPartners',
  page: 0,
  size: 20
});

// Executar uma requisição POST usando método auxiliar
const newCustomer = await serviceLayer.post({
  url: 'BusinessPartners',
  data: {
    CardCode: 'C00001',
    CardName: 'Cliente Teste',
    CardType: 'C'
  }
});


// Executar operações em batch
const batchResults = await serviceLayer.executeBatch({
  transaction: true,
  operations: [
    {
      method: 'POST',
      url: 'BusinessPartners',
      data: { CardCode: 'C00002', CardName: 'Cliente 2' }
    },
    {
      method: 'POST',
      url: 'BusinessPartners',
      data: { CardCode: 'C00003', CardName: 'Cliente 3' }
    }
  ]
});
```

## API

### `constructor(config: ServiceLayerConfig)`

Construtor da classe ServiceLayer.

**Parâmetros:**
- `database`: Nome do banco de dados
- `url`: URL base do Service Layer (ex: `https://localhost:50000/b1s/v1`)
- `username`: Nome de usuário
- `password`: Senha
- `language`: Idioma (opcional, padrão: `"29"`)
- `timeout`: Timeout em milissegundos (opcional, padrão: `0`)

### `login(): Promise<void>`

Realiza login no Service Layer usando as credenciais configuradas no construtor.

### `get<T>(config: RequestConfig): Promise<PaginatedResponse<T>>`

Executa uma requisição GET.

**Parâmetros:**
- `url`: Endpoint relativo (ex: `BusinessPartners`)
- `header`: Headers customizados (opcional)
- `page`: Número da página para paginação (opcional)
- `size`: Tamanho da página (opcional)
- `timeout`: Timeout em milissegundos (opcional)

### `post<T>(config: RequestConfig): Promise<PaginatedResponse<T>>`

Executa uma requisição POST.

**Parâmetros:**
- `url`: Endpoint relativo
- `header`: Headers customizados (opcional)
- `data`: Dados para enviar no body (opcional)
- `timeout`: Timeout em milissegundos (opcional)

### `put<T>(config: RequestConfig): Promise<PaginatedResponse<T>>`

Executa uma requisição PUT.

**Parâmetros:**
- `url`: Endpoint relativo
- `header`: Headers customizados (opcional)
- `data`: Dados para enviar no body (opcional)
- `timeout`: Timeout em milissegundos (opcional)

### `patch<T>(config: RequestConfig): Promise<PaginatedResponse<T>>`

Executa uma requisição PATCH.

**Parâmetros:**
- `url`: Endpoint relativo
- `header`: Headers customizados (opcional)
- `data`: Dados para enviar no body (opcional)
- `timeout`: Timeout em milissegundos (opcional)

### `delete<T>(config: RequestConfig): Promise<PaginatedResponse<T>>`

Executa uma requisição DELETE.

**Parâmetros:**
- `url`: Endpoint relativo
- `header`: Headers customizados (opcional)
- `timeout`: Timeout em milissegundos (opcional)


### `executeBatch(config: ExecuteBatchConfig): Promise<BatchResponse[]>`

Executa múltiplas operações em batch.

**Parâmetros:**
- `transaction`: Se `true`, executa todas as operações em uma transação (opcional)
- `operations`: Array de operações a executar
- `header`: Headers customizados (opcional)
- `timeout`: Timeout em milissegundos (opcional)

### `executeSmlsvc<T>(config: ExecuteSmlsvcConfig): Promise<T>`

Executa uma requisição SMLSVC.

**Parâmetros:**
- `url`: Endpoint relativo
- `headers`: Headers customizados (opcional)

### `logout(): Promise<void>`

Realiza logout do Service Layer.

## Tipos

A biblioteca exporta os seguintes tipos TypeScript:

- `ServiceLayerConfig`
- `RequestConfig`
- `ExecuteBatchConfig`
- `ExecuteSmlsvcConfig`
- `PaginatedResponse<T>`
- `BatchResponse`
- `BatchOperation`

## Recursos

- ✅ Suporte completo a TypeScript com tipos
- ✅ Retry automático em caso de erro 502
- ✅ Reconexão automática em caso de erro 401
- ✅ Suporte a paginação
- ✅ Suporte a operações batch
- ✅ Suporte a transações batch
- ✅ Tratamento de erros robusto


## Licença

MIT
