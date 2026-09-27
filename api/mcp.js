const BASE = "https://naver-gpt-connector.vercel.app";

const tools = [
  {
    name: "searchNaver",
    description: "네이버에서 실제 검색 결과를 조회합니다.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        type: {
          type: "string",
          enum: [
            "blog", "news", "book", "encyc", "cafearticle",
            "kin", "local", "webkr", "image", "shop", "doc", "movie"
          ],
          default: "blog"
        },
        display: { type: "integer", default: 10 },
        start: { type: "integer", default: 1 },
        sort: {
          type: "string",
          enum: ["sim", "date"],
          default: "sim"
        }
      },
      required: ["query"]
    }
  },

  {
    name: "getNaverContent",
    description:
      "네이버 블로그 등 실제 URL의 본문을 읽습니다. hasMore가 true이면 nextOffset을 offset으로 넣어 반복 호출하여 hasMore=false가 될 때까지 읽습니다.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        offset: {
          type: "integer",
          minimum: 0,
          default: 0
        },
        limit: {
          type: "integer",
          minimum: 1000,
          maximum: 20000,
          default: 12000
        }
      },
      required: ["url"]
    }
  },

  {
    name: "searchNaverAndRead",
    description:
      "네이버를 검색한 뒤 검색 설명문이 아니라 검색 결과의 실제 URL 본문을 읽습니다.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        type: {
          type: "string",
          default: "blog"
        },
        display: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          default: 5
        },
        start: {
          type: "integer",
          minimum: 1,
          default: 1
        },
        sort: {
          type: "string",
          enum: ["sim", "date"],
          default: "sim"
        },
        limit: {
          type: "integer",
          minimum: 1000,
          maximum: 20000,
          default: 12000
        }
      },
      required: ["query"]
    }
  },

  {
    name: "getNaverShoppingRank",
    description: "네이버쇼핑에서 특정 스토어 또는 상품의 노출 순위를 조회합니다.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        targetMallName: { type: "string" },
        targetProductId: { type: "string" },
        targetKeyword: { type: "string" },
        maxRank: {
          type: "integer",
          default: 100
        },
        maxMatches: {
          type: "integer",
          default: 20
        }
      },
      required: ["query"]
    }
  },

  {
    name: "getNaverShoppingInsight",
    description: "네이버 쇼핑인사이트 카테고리 클릭 트렌드를 조회합니다.",
    inputSchema: {
      type: "object",
      properties: {
        name1: { type: "string" },
        code1: { type: "string" },
        name2: { type: "string" },
        code2: { type: "string" },
        name3: { type: "string" },
        code3: { type: "string" },
        startDate: { type: "string" },
        endDate: { type: "string" },
        timeUnit: {
          type: "string",
          default: "week"
        },
        device: { type: "string" }
      },
      required: [
        "name1",
        "code1",
        "startDate",
        "endDate"
      ]
    }
  },

  {
    name: "getGoogleTrends",
    description: "Google Trends 관심도 추이를 조회합니다.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string" },
        geo: {
          type: "string",
          default: "KR"
        },
        timeframe: {
          type: "string",
          default: "today 3-m"
        }
      },
      required: ["keyword"]
    }
  }
];

function params(args) {
  const p = new URLSearchParams();

  for (const [key, value] of Object.entries(args || {})) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      p.set(key, String(value));
    }
  }

  return p.toString();
}

async function callApi(path, args) {
  const url = `${BASE}${path}?${params(args)}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        status: response.status,
        data
      })
    );
  }

  return data;
}

async function executeTool(name, args) {
  if (name === "searchNaver") {
    return callApi("/api/search", args);
  }

  if (name === "getNaverContent") {
    return callApi("/api/content", args);
  }

  if (name === "getNaverShoppingRank") {
    return callApi("/api/shopping-rank", args);
  }

  if (name === "getNaverShoppingInsight") {
    return callApi("/api/shopping-insight", args);
  }

  if (name === "getGoogleTrends") {
    return callApi("/api/trends", args);
  }

  if (name === "searchNaverAndRead") {
    const search = await callApi("/api/search", {
      query: args.query,
      type: args.type || "blog",
      display: args.display || 5,
      start: args.start || 1,
      sort: args.sort || "sim"
    });

    const results = [];

    for (const item of search.items || []) {
      if (!item.link) continue;

      try {
        const body = await callApi("/api/content", {
          url: item.link,
          offset: 0,
          limit: args.limit || 12000
        });

        results.push({
          searchTitle: item.title,
          link: item.link,
          postdate: item.postdate || null,
          bloggername: item.bloggername || null,
          body
        });
      } catch (error) {
        results.push({
          searchTitle: item.title,
          link: item.link,
          error: String(error)
        });
      }
    }

    return {
      query: args.query,
      count: results.length,
      results
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function readBody(req) {
  if (
    req.body &&
    typeof req.body === "object"
  ) {
    return req.body;
  }

  let raw = "";

  for await (const chunk of req) {
    raw += chunk;
  }

  return raw ? JSON.parse(raw) : {};
}

function send(res, status, data) {
  res.statusCode = status;

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Mcp-Session-Id"
  );

  if (data === null) {
    return res.end();
  }

  res.setHeader(
    "Content-Type",
    "application/json"
  );

  return res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return send(res, 204, null);
  }

  if (req.method !== "POST") {
    return send(res, 405, {
      error: "POST only"
    });
  }

  let body;

  try {
    body = await readBody(req);
  } catch (error) {
    return send(res, 400, {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error"
      }
    });
  }

  const id =
    Object.prototype.hasOwnProperty.call(body, "id")
      ? body.id
      : null;

  if (
    body.method === "notifications/initialized" ||
    body.method === "notifications/cancelled"
  ) {
    return send(res, 202, null);
  }

  if (body.method === "initialize") {
    return send(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "naver-research",
          version: "1.0.0"
        }
      }
    });
  }

  if (body.method === "ping") {
    return send(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {}
    });
  }

  if (body.method === "tools/list") {
    return send(res, 200, {
      jsonrpc: "2.0",
      id,
      result: {
        tools
      }
    });
  }

  if (body.method === "tools/call") {
    try {
      const name = body.params?.name;
      const args =
        body.params?.arguments || {};

      const result =
        await executeTool(name, args);

      return send(res, 200, {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result)
            }
          ]
        }
      });
    } catch (error) {
      return send(res, 200, {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: String(error)
            }
          ]
        }
      });
    }
  }

  return send(res, 200, {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Method not found: ${body.method}`
    }
  });
};
