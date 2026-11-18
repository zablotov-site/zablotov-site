import { getContent, json } from "../_lib.js";
export async function onRequestGet(ctx) { return json(await getContent(ctx.env)); }
