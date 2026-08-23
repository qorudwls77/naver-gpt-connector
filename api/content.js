// GET /api/content?url=https://blog.naver.com/xxx/yyy
// 주어진 URL(주로 네이버 블로그/뉴스/카페 등)의 페이지를 가져와 본문 텍스트만 추출해서 반환합니다.

const cheerio = require("cheerio");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const MAX_CONTENT_LENGTH = 15000; // 챗GPT로 넘길 때 너무 길어지지 않도록 자름

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "url 파라미터가 필요합니다." });
  }

  let target;
  try {
    target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) throw new Error("invalid protocol");
  } catch (e) {
    return res.status(400).json({ error: "유효하지 않은 url입니다." });
  }

  // 네이버 블로그(blog.naver.com/블로그아이디/글번호)는 본문이 iframe 안에 있어
  // 그대로 가져오면 본문을 못 읽으므로, 실제 본문이 바로 나오는 모바일 뷰로 변환합니다.
  if (target.hostname === "blog.naver.com") {
    const parts = target.pathname.split("/").filter(Boolean);
    let blogId, logNo;
    if (parts.length >= 2) {
      [blogId, logNo] = parts;
    } else if (target.searchParams.get("blogId") && target.searchParams.get("logNo")) {
      blogId = target.searchParams.get("blogId");
      logNo = target.searchParams.get("logNo");
    }
    if (blogId && logNo) {
      target = new URL(
        `https://m.blog.naver.com/PostView.naver?blogId=${encodeURIComponent(blogId)}&logNo=${encodeURIComponent(logNo)}`
      );
    }
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
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

    // 네이버 블로그는 본문이 iframe(mainFrame) 안에 있는 경우가 많아,
    // 스마트에디터 본문 셀렉터를 우선 시도하고 없으면 body 전체 텍스트로 대체합니다.
    const candidates = [
      ".se-main-container", // 스마트에디터 ONE
      "#postViewArea", // 구 에디터
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
      $("script, style, nav, header, footer").remove();
      bodyText = $("body").text();
    }

    const cleaned = bodyText.replace(/\s+/g, " ").trim().slice(0, MAX_CONTENT_LENGTH);
    const title = $("title").first().text().trim();

    return res.status(200).json({
      requested_url: url,
      fetched_url: target.toString(),
      title,
      content: cleaned,
      truncated: bodyText.length > MAX_CONTENT_LENGTH
    });
  } catch (err) {
    return res.status(502).json({ error: "페이지 처리 중 오류가 발생했습니다.", detail: String(err) });
  }
};
