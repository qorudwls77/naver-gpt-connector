// GET /api/shopping-rank?query=키워드&targetMallName=스토어명&targetProductId=상품ID&targetKeyword=상품명키워드&maxRank=200
//
// 네이버쇼핑 검색 결과에서 특정 스토어(mallName) 또는 특정 상품(productId)이
// 몇 위에 노출되는지 순위를 찾아주는 API입니다.
// 내부적으로 네이버 검색 API(shop 카테고리)를 display=100 단위로 여러 번 호출해서
// maxRank 위까지 순서대로 훑으며 조건에 맞는 상품을 찾습니다.
//
// targetProductId / targetMallName / targetKeyword 중 최소 하나는 있어야 합니다.
// - targetProductId: 네이버쇼핑 상품 고유 ID (가장 정확함, item.link의 catalog/id 값)
// - targetMallName: 스토어(쇼핑몰) 이름. 부분 일치 + 공백 무시로 비교합니다.
// - targetKeyword: 상품명(title)에 포함되어야 하는 단어. 부분 일치 + 공백 무시로 비교합니다.
// 여러 조건을 같이 주면 모두 만족하는 상품만 매칭됩니다.

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function stripHtml(str = "") {
  return String(str).replace(/<[^>]*>/g, "");
}

function normalize(str = "") {
  return stripHtml(str).replace(/\s+/g, "").toLowerCase();
}

const MAX_RANK_LIMIT = 1000; // 네이버 검색 API의 start 최대값(1000) 기준
const PAGE_SIZE = 100; // 네이버 검색 API의 display 최대값

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const {
    query,
    targetMallName,
    targetProductId,
    targetKeyword,
    maxRank: maxRankRaw,
    maxMatches: maxMatchesRaw
  } = req.query;

  if (!query) {
    return res.status(400).json({ error: "query 파라미터(검색 키워드)가 필요합니다." });
  }
  if (!targetMallName && !targetProductId && !targetKeyword) {
    return res.status(400).json({
      error: "targetMallName, targetProductId, targetKeyword 중 최소 하나는 지정해야 합니다."
    });
  }

  let maxRank = parseInt(maxRankRaw, 10);
  if (!Number.isFinite(maxRank) || maxRank <= 0) maxRank = 100;
  if (maxRank > MAX_RANK_LIMIT) maxRank = MAX_RANK_LIMIT;

  let maxMatches = parseInt(maxMatchesRaw, 10);
  if (!Number.isFinite(maxMatches) || maxMatches <= 0) maxMatches = 20;

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "서버에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되어 있지 않습니다."
    });
  }

  const normMallName = targetMallName ? normalize(targetMallName) : null;
  const normKeyword = targetKeyword ? normalize(targetKeyword) : null;

  function isMatch(item) {
    if (targetProductId && String(item.productId) !== String(targetProductId)) return false;
    if (normMallName && !normalize(item.mallName).includes(normMallName)) return false;
    if (normKeyword && !normalize(item.title).includes(normKeyword)) return false;
    return true;
  }

  const matches = [];
  let checked = 0;
  let totalAvailable = null;

  try {
    for (let start = 1; start <= maxRank; start += PAGE_SIZE) {
      const display = Math.min(PAGE_SIZE, maxRank - start + 1);

      const url = new URL("https://naverapihub.apigw.ntruss.com/search/v1/shop");
      url.searchParams.set("query", query);
      url.searchParams.set("display", String(display));
      url.searchParams.set("start", String(start));
      url.searchParams.set("sort", "sim");

      const response = await fetch(url.toString(), {
        headers: {
          "X-NCP-APIGW-API-KEY-ID": clientId,
          "X-NCP-APIGW-API-KEY": clientSecret
        }
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: "네이버 쇼핑 검색 API 호출에 실패했습니다.",
          status: response.status,
          detail: data
        });
      }

      if (totalAvailable === null) totalAvailable = data.total;
      const items = data.items || [];

      items.forEach((item, idx) => {
        const rank = start + idx;
        checked = rank;
        if (isMatch(item)) {
          matches.push({
            rank,
            title: stripHtml(item.title),
            mallName: item.mallName,
            productId: item.productId,
            lprice: item.lprice,
            link: item.link,
            image: item.image,
            brand: item.brand || null,
            maker: item.maker || null
          });
        }
      });

      // 네이버가 더 내려줄 결과가 없으면 조기 종료
      if (items.length < display) break;
      if (matches.length >= maxMatches) break;
    }

    return res.status(200).json({
      query,
      target: {
        targetMallName: targetMallName || null,
        targetProductId: targetProductId || null,
        targetKeyword: targetKeyword || null
      },
      maxRank,
      checkedUpToRank: checked,
      totalAvailable,
      found: matches.length > 0,
      bestRank: matches.length > 0 ? matches[0].rank : null,
      matches: matches.slice(0, maxMatches)
    });
  } catch (err) {
    return res.status(502).json({
      error: "네이버 쇼핑 순위 조회 중 오류가 발생했습니다.",
      detail: String(err)
    });
  }
};
