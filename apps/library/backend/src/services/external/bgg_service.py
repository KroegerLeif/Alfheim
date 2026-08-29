"""Service for looking up board game metadata via BoardGameGeek (BGG) XML API2."""

import html
import logging
import xml.etree.ElementTree as ET

import httpx
from fastapi import HTTPException, status
from src.db.models import MediaType
from src.schemas.lookup import BoardGameLookupListResponse, BoardGameLookupResponse

logger = logging.getLogger("library.backend.bgg")


def _clean_description(raw_desc: str | None) -> str | None:
    """Clean HTML entities and newline noise from BGG game descriptions."""
    if not raw_desc:
        return None
    unescaped = html.unescape(raw_desc)
    # Remove common HTML break tags
    cleaned = unescaped.replace("<br/>", "\n").replace("<br>", "\n").replace("&amp;", "&")
    return cleaned.strip() or None


async def fetch_bgg_metadata(query: str) -> BoardGameLookupListResponse:
    """Search for board games on BoardGameGeek and retrieve detailed metadata.

    Raises:
        HTTPException 400: If search query is empty.
        HTTPException 404: If no board games match the query.
        HTTPException 502: If communication with BGG API fails or returns invalid XML.
    """
    clean_query = query.strip()
    if not clean_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query parameter 'query' cannot be empty.",
        )

    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Search for matching board game IDs
            search_url = "https://boardgamegeek.com/xmlapi2/search"
            search_params = {"type": "boardgame", "query": clean_query}
            search_res = await client.get(search_url, params=search_params, timeout=10.0)
            if search_res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="BoardGameGeek API search failed.",
                )

            try:
                search_xml = ET.fromstring(search_res.content)
            except ET.ParseError as err:
                logger.error("Failed to parse BGG search XML: %s", err)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Invalid XML payload received from BoardGameGeek.",
                ) from err

            item_elems = search_xml.findall("item")
            if not item_elems:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No board games found matching query '{clean_query}'.",
                )

            # Limit to top 5 items for detailed lookup
            game_ids = [gid for item in item_elems[:5] if (gid := item.get("id")) is not None]
            if not game_ids:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No board games found matching query '{clean_query}'.",
                )

            # Step 2: Query details for retrieved BGG IDs
            ids_param = ",".join(game_ids)
            thing_url = "https://boardgamegeek.com/xmlapi2/thing"
            thing_params = {"id": ids_param, "stats": "1"}
            thing_res = await client.get(thing_url, params=thing_params, timeout=10.0)
            if thing_res.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="BoardGameGeek API thing details fetch failed.",
                )

            try:
                thing_xml = ET.fromstring(thing_res.content)
            except ET.ParseError as err:
                logger.error("Failed to parse BGG thing XML: %s", err)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Invalid XML details payload received from BoardGameGeek.",
                ) from err

            results: list[BoardGameLookupResponse] = []
            for item in thing_xml.findall("item"):
                bgg_id = item.get("id")

                # Extract primary title
                title = "Unknown Game"
                for name_elem in item.findall("name"):
                    if name_elem.get("type") == "primary":
                        title = name_elem.get("value", title)
                        break

                description = _clean_description(item.findtext("description"))

                # Images
                image_url = item.findtext("image") or item.findtext("thumbnail")

                # Player counts and runtime
                min_players_elem = item.find("minplayers")
                max_players_elem = item.find("maxplayers")
                playingtime_elem = item.find("playingtime")

                min_val = min_players_elem.get("value") if min_players_elem is not None else None
                max_val = max_players_elem.get("value") if max_players_elem is not None else None
                play_val = playingtime_elem.get("value") if playingtime_elem is not None else None

                min_players = int(min_val) if min_val and min_val.isdigit() else None
                max_players = int(max_val) if max_val and max_val.isdigit() else None
                runtime_minutes = int(play_val) if play_val and play_val.isdigit() else None

                # Designers / Publishers
                designers = [
                    v
                    for link in item.findall("link")
                    if link.get("type") == "boardgamedesigner" and (v := link.get("value")) is not None
                ]
                author_creator = ", ".join(designers) if designers else None

                # Categories
                categories = [
                    v
                    for link in item.findall("link")
                    if link.get("type") == "boardgamecategory" and (v := link.get("value")) is not None
                ]

                results.append(
                    BoardGameLookupResponse(
                        id=bgg_id,
                        title=title,
                        media_type=MediaType.GAME,
                        author_creator=author_creator,
                        description=description,
                        min_players=min_players,
                        max_players=max_players,
                        runtime_minutes=runtime_minutes,
                        cover_image_url=image_url,
                        categories=categories,
                    )
                )

            if not results:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No board game metadata retrieved for query '{clean_query}'.",
                )

            return BoardGameLookupListResponse(
                results=results,
                total=len(results),
            )

    except httpx.HTTPError as exc:
        logger.error("HTTP error during BGG lookup for query '%s': %s", clean_query, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="External service communication error while fetching BoardGameGeek metadata.",
        ) from exc
