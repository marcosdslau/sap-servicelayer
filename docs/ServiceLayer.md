#Exemplo de conexão javascript puro com ServiceLayerSAP

```
const axios = require("axios");
const https = require("https");

const agent = new https.Agent({
  rejectUnauthorized: false,
});

class ServiceLayer {
  /*constructor() {
    this.cookie = "";
    this.database = null;
    this.url = null;
  }*/
  async login({ username, password, language = "29", timeout = 0 }) {
    try {
      const url = `${this.url}/Login`;

      await axios.post(
        url,
        {
          CompanyDB: this.database,
          UserName: username,
          Password: password,
          Language: language,
        },
        {
          httpsAgent: agent,
          timeout,
          // headers: this.cookie, // Não podemos enviar o cookie antigo no login, ocorre um erro na SL. Erro: name.toLowerCase is not a function
        }
      );
    } catch (ex) {
      // console.error(ex);
      throw ex;
    }
  }

  async init({
    database,
    username,
    password,
    url,
    language = "29",
    timeout = 0,
  }) {
    const me = this;

    async function execute(retries = 0) {
      me.routerId = "";
      me.cookie = ""; // Quando mandamos o cookie antigo no login, ocorre um erro na SL. Erro: name.toLowerCase is not a function
      me.database = database;
      me.username = username;
      me.password = password;
      me.url = url;
      me.language = language;

      const urlParse = `${me.url}/Login`;

      let response;
      try {
        response = await axios.post(
          urlParse,
          {
            CompanyDB: database,
            UserName: username,
            Password: password,
            Language: language,
          },
          {
            httpsAgent: agent,
            timeout,
            headers: me.cookie,
          }
        );
      } catch (ex) {
        // console.error(ex);
        if (!ex.response) {
          ex.response = {};
        }

        if (
          !ex.hasOwnProperty("response") ||
          !ex.response.hasOwnProperty("status")
        ) {
          throw ex;
        }
        switch (ex.response.status) {
          case 502:
            console.log("Nova tentativa, erro 502. " + retries);
            if (retries < 5) {
              return await execute(++retries);
            } else {
              throw ex;
            }
          default:
            // console.error(ex);
            throw ex;
        }
      }
      const headerCookie = response.headers["set-cookie"];

      headerCookie.map((cookie) => {
        const [key, value] = cookie.split("=");

        if (cookie.indexOf("ROUTEID") > -1) {
          me.routerId += `${key}=${value}`;
        } else {
          me.cookie += `${key}=${value}`;
        }
      });
    }

    return await execute();
  }

  async logout() {
    // Deve ser feito no lado do cliente apenas apagando o token recebido no login
  }
  async execute({ url, method, header, data, page, size, timeout = 0 }) {
    const me = this;
    async function execute(retries = 0) {
      const customHeaders = {
        Cookie: me.cookie,
      };

      if (header) for (const prop in header) customHeaders[prop] = header[prop];

      if (size) {
        const newHeader = {
          Prefer: "odata.maxpagesize=" + size,
        };
        for (const prop in newHeader) customHeaders[prop] = newHeader[prop];
      }
      let info = "";

      if (page != undefined && page != null) {
        const skipPage = (page || 0) * (size || 20);
        const idx = url.indexOf("?");
        info = (idx >= 0 ? "&" : "?") + "$skip=" + skipPage;
      }

      const newUrl = `${me.url}/${url}${info}`;
      let response;
      try {
        response = await axios({
          method,
          url: newUrl,
          httpsAgent: agent,
          headers: customHeaders,
          data: data ? JSON.stringify(data) : null,
          timeout,
        });
      } catch (ex) {
        // console.error(ex);
        if (!ex.response) {
          ex.response = {};
        }

        if (
          !ex.hasOwnProperty("response") ||
          !ex.response.hasOwnProperty("status")
        ) {
          throw ex;
        }
        switch (ex.response.status) {
          case 401:
            console.log("Reconectando na service layer. " + retries);
            await me.init({
              database: me.database,
              username: me.username,
              password: me.password,
              url: me.url,
              language: me.language,
            });
            if (retries < 5) {
              return await execute(++retries);
            } else {
              throw ex;
            }
          case 502:
            console.log("Nova tentativa, erro 502. " + retries);
            if (retries < 5) {
              return await execute(++retries);
            } else {
              throw ex;
            }
          default:
            // console.error(ex);
            throw ex;
        }
      }

      if (page != undefined && page != null) {
        response.data.previous = page > 0;
        response.data.next = response.data["odata.nextLink"] != undefined;
      }

      return response.data;
    }

    return await execute();
  }

  async executeBatch({ transaction, operations, header, timeout = 0 }) {
    const me = this;

    async function executeBatch(retries = 0) {
      var guidGen = function () {
        var S4 = function () {
          return (((1 + Math.random()) * 0x10000) | 0)
            .toString(16)
            .substring(1);
        };
        return (
          S4() +
          S4() +
          "-" +
          S4() +
          "-" +
          S4() +
          "-" +
          S4() +
          "-" +
          S4() +
          S4() +
          S4()
        );
      };
      const batchBoundary = "batch_" + guidGen();
      const changeSetBoundary = transaction ? "changeset_" + guidGen() : "";
      const customHeaders = {
        Cookie: me.cookie,
        "Content-Type": `multipart/mixed;boundary=${batchBoundary}`,
        "OData-Version": "4.0",
      };

      if (header) for (const prop in header) customHeaders[prop] = header[prop];

      const url = `${me.url}/$batch`;

      const getVersionSL = (fullUrl) => {
        const match = fullUrl.match(/\/b1s\/v[0-9]+/);
        const basePath = match ? match[0] : "/b1s/v1";
        return basePath.endsWith("/") ? basePath : `${basePath}/`;
      };

      const createHeader = (header) => {
        let data = "";
        for (const prop in header) {
          data += `${prop}: ${header[prop]}\n`;
        }
        return data;
      };

      const versionSL = getVersionSL(me.url);

      let data = "";
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        if (i == 0 && transaction) {
          data += `--${batchBoundary}\n`;
          data += `Content-Type: multipart/mixed;boundary=${changeSetBoundary}\n`;
        }
        if (transaction) {
          data += `--${changeSetBoundary}\n`;
        } else {
          data += `--${batchBoundary}\n`;
        }
        data += "Content-Type: application/http\n";
        data += "Content-Transfer-Encoding:binary\n";
        data += `Content-ID: ${i + 1}\n\n`;
        data += `${operation.method} ${versionSL}${operation.url}\n`;
        data += createHeader(operation.header);
        data += "\n";

        if (operation.data) {
          //data += "Content-Type: application/json\n\n";
          data += JSON.stringify(operation.data) + "\n\n";
        }
      }
      if (transaction) {
        data += `--${changeSetBoundary}--\n`;
      }
      data += `--${batchBoundary}--\n`;

      let response;
      try {
        response = await axios({
          method: "post",
          url,
          httpsAgent: agent,
          headers: customHeaders,
          data,
          timeout,
        });
      } catch (ex) {
        // console.error(ex);
        if (!ex.response) {
          ex.response = {};
        }

        if (
          !ex.hasOwnProperty("response") ||
          !ex.response.hasOwnProperty("status")
        ) {
          throw ex;
        }
        switch (ex.response.status) {
          case 401:
            console.log("Reconectando na service layer. " + retries);
            await me.init({
              database: me.database,
              username: me.username,
              password: me.password,
              url: me.url,
              language: me.language,
            });
            if (retries < 5) {
              return await executeBatch(++retries);
            } else {
              throw ex;
            }
          case 502:
            console.log("Nova tentativa, erro 502. " + retries);
            if (retries < 5) {
              return await executeBatch(++retries);
            } else {
              throw ex;
            }
          default:
            // console.error(ex);
            throw ex;
        }
      }
      const responseArray = [];
      const responseLines = response.data.split(/\r?\n/);
      // quando tem transação, o boundary é --changesetresponse, MAS se houve rollback, é --batchresponse mesmo...
      const boundaryRex = response.data.match(/\n--changesetresponse/)
        ? new RegExp("^--changesetresponse")
        : new RegExp("^--batchresponse");
      let seekStatus = "init";
      let contentId = null;
      let httpCode = null;
      let httpStatus = null;
      let json = null;
      let jsonStr = "";
      for (let i = 0; i < responseLines.length; i++) {
        const line = responseLines[i];
        if (seekStatus == "init") {
          // skip para o primeiro resultado
          if (!line.match(boundaryRex)) {
            continue;
          } else {
            seekStatus = "response";
            continue;
          }
        } else {
          if (line.match(boundaryRex)) {
            // já está em um resultado, encontrou o próximo ou o fim do retorno
            const responseItem = {
              httpCode,
              httpStatus,
              contentId,
              json,
            };
            responseArray.push(responseItem);
            contentId = null;
            httpCode = null;
            httpStatus = null;
            json = null;
            jsonStr = "";
            seekStatus = "response";
            continue;
          }
        }
        if (seekStatus == "response") {
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
            jsonStr += "{\n";
            seekStatus = "json";
            continue;
          }
        }
        if (seekStatus == "json") {
          jsonStr += line + "\n";
          if (line.match(/^}$/)) {
            json = JSON.parse(jsonStr);
          }
        }
      }
      return responseArray;
    }

    return await executeBatch();
  }

  async executeSmlsvc({ url, headers }) {
    const me = this;
    async function execute(retries = 0) {
      me.retries = retries;
      const customHeaders = {
        Cookie: me.cookie,
      };

      if (headers)
        for (const prop in headers) customHeaders[prop] = headers[prop];

      const newUrl = `${me.url}/${url}`;

      try {
        const response = await axios.get(newUrl, {
          httpsAgent: agent,
          headers: customHeaders,
          timeout: 0,
        });
        return response.data;
      } catch (ex) {
        // console.error(ex);
        if (!ex.response) {
          ex.response = {};
        }

        if (
          !ex.hasOwnProperty("response") ||
          !ex.response.hasOwnProperty("status")
        ) {
          throw ex;
        }
        switch (ex.response.status) {
          case 401:
            console.log("Reconectando na service layer. " + retries);
            await me.init({
              database: me.database,
              username: me.username,
              password: me.password,
              url: me.url,
              language: me.language,
            });
            if (retries < 5) {
              return await execute(++retries);
            } else {
              throw ex;
            }
          case 502:
            console.log("Nova tentativa, erro 502. " + retries);
            if (retries < 5) {
              return await execute(++retries);
            } else {
              throw ex;
            }
          default:
            // console.error(ex);
            throw ex;
        }
      }
    }

    return await execute();
  }
}

module.exports = ServiceLayer;

```