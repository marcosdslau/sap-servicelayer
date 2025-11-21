# sap-servicelayer

Biblioteca TypeScript para integração com SAP Service Layer API. Esta biblioteca fornece uma interface simples e tipada para interagir com o SAP Business One Service Layer.

## Instalação

```bash
npm install sap-servicelayer
```

## Uso Básico

```typescript
import { ServiceLayer } from 'sap-servicelayer';

const serviceLayer = new ServiceLayer();

// Inicializar conexão
await serviceLayer.init({
  database: 'SBODEMOUS',
  username: 'manager',
  password: '1234',
  url: 'https://localhost:50000/b1s/v1',
  language: '29'
});

// Executar uma requisição GET
const customers = await serviceLayer.execute({
  url: 'BusinessPartners',
  method: 'GET',
  page: 0,
  size: 20
});

// Executar uma requisição POST
const newCustomer = await serviceLayer.execute({
  url: 'BusinessPartners',
  method: 'POST',
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

### `init(config: InitConfig): Promise<void>`

Inicializa a conexão com o Service Layer e realiza o login.

**Parâmetros:**
- `database`: Nome do banco de dados
- `username`: Nome de usuário
- `password`: Senha
- `url`: URL base do Service Layer (ex: `https://localhost:50000/b1s/v1`)
- `language`: Idioma (padrão: `"29"`)
- `timeout`: Timeout em milissegundos (padrão: `0`)

### `execute<T>(config: ExecuteConfig): Promise<PaginatedResponse<T>>`

Executa uma requisição HTTP no Service Layer.

**Parâmetros:**
- `url`: Endpoint relativo (ex: `BusinessPartners`)
- `method`: Método HTTP (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
- `header`: Headers customizados (opcional)
- `data`: Dados para enviar no body (opcional)
- `page`: Número da página para paginação (opcional)
- `size`: Tamanho da página (opcional)
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

- `LoginConfig`
- `InitConfig`
- `ExecuteConfig`
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

## Desenvolvimento

```bash
# Instalar dependências
npm install

# Compilar TypeScript
npm run build

# Publicar no npm
npm publish
```

## Licença

MIT
