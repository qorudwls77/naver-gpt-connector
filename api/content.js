// GET /api/content?url=...&offset=0&limit=12000
// 페이지 본문 전체를 추출한 뒤 offset/limit 단위로 나누어 반환합니다.

const cheerio = require("cheerio");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const DEFAULT_LIMIT = 12000;
const MAX_LIMIT = 20000;

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "GET 요청만 지원합니다."
    });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      error: "url 파라미터가 필요합니다."
    });
  }

  const parsedOffset = parseInt(req.query.offset ?? "0", 10);
  const parsedLimit = parseInt(
    req.query.limit ?? String(DEFAULT_LIMIT),
    10
  );

  const offset = Number.isFinite(parsedOffset)
    ? Math.max(0, parsedOffset)
    : 0;

  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1000, parsedLimit))
    : DEFAULT_LIMIT;

  let target;

  try {
    target = new URL(url);

    if (!/^https?:$/.test(target.protocol)) {
      throw new Error("invalid protocol");
    }
  } catch (e) {
    return res.status(400).json({
      error: "유효하지 않은 url입니다."
    });
  }

  // 네이버 블로그 일반 주소를 실제 본문을 읽을 수 있는
  // 모바일 PostView 주소로 변환합니다.
  if (
    target.hostname === "blog.naver.com" ||
    target.hostname === "m.blog.naver.com"
  ) {
    let blogId;
    let logNo;

    if (target.pathname.includes("PostView.naver")) {
      blogId = target.searchParams.get("blogId");
      logNo = target.searchParams.get("logNo");
    } else {
      const parts = target.pathname.split("/").filter(Boolean);

      if (parts.length >= 2) {
        [blogId, logNo] = parts;
      } else {
        blogId = target.searchParams.get("blogId");
        logNo = target.searchParams.get("logNo");
      }
    }

    if (blogId && logNo) {
      target = new URL(
        `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(
          blogId
        )}&logNo=${encodeURIComponent(logNo)}`
      );
    }
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "대상 페이지를 가져오는 데 실패했습니다.",
        status: response.status
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const candidates = [
      ".se-main-container",
      ".se_component_wrap",
      ".se_doc_viewer",
      "#postViewArea",
      "article",
      "#content",
      "main"
    ];

    let bodyText = "";

    for (const sel of candidates) {
      const el = $(sel);

      if (el.length && el.text().trim().length > 100) {
        bodyText = el.text();
        break;
      }
    }

    if (!bodyText) {
      $("script, style, noscript, svg, nav, header, footer").remove();
      bodyText = $("body").text();
    }

    // 여기서는 전체 본문을 먼저 보존합니다.
    const cleaned = bodyText
      .replace(/\s+/g, " ")
      .trim();

    const totalLength = cleaned.length;
    const safeOffset = Math.min(offset, totalLength);

    const content = cleaned.slice(
      safeOffset,
      safeOffset + limit
    );

    const candidateNextOffset =
      safeOffset + content.length;

    const hasMore =
      candidateNextOffset < totalLength;

    const nextOffset = hasMore
      ? candidateNextOffset
      : null;

    const title = $("title")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    return res.status(200).json({
      requested_url: url,
      fetched_url: target.toString(),
      title,
      content,

      offset: safeOffset,
      limit,
      returnedLength: content.length,
      totalLength,

      hasMore,
      nextOffset,

      // 기존 사용처와의 호환성을 위해 유지
      truncated: hasMore
    });
  } catch (err) {
    return res.status(502).json({
      error: "페이지 처리 중 오류가 발생했습니다.",
      detail: String(err)
    });
  }
};
