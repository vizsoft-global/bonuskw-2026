import { NextRequest, NextResponse } from "next/server";
import { algoliasearch } from "algoliasearch";
import { ALGOLIA_APP_ID } from "@/lib/firebase/config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const rating = Number(req.nextUrl.searchParams.get("rating") || 0);
  const sort = req.nextUrl.searchParams.get("sort") || "";
  if (!q) return NextResponse.json({ hits: [] });

  const key = process.env.ALGOLIA_SEARCH_KEY;
  if (!key) return NextResponse.json({ hits: [], fallback: true });

  const client = algoliasearch(ALGOLIA_APP_ID, key);
  const filters = rating > 0 ? `totalRatting >= ${rating}` : undefined;
  const result = await client.searchSingleIndex({
    indexName: sort === "price_asc" ? "courses_price_asc" : sort === "price_desc" ? "courses_price_desc" : "courses",
    searchParams: { query: q, filters, hitsPerPage: 24 },
  });
  return NextResponse.json({ hits: result.hits });
}
