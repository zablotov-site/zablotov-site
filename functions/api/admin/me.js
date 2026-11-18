import { isAdmin, json } from "../../_lib.js";
export async function onRequestGet(ctx) { return json({ admin: await isAdmin(ctx) }); }
