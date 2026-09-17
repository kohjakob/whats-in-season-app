import { handleNormals } from '../src/server/normals';

export const config = { runtime: 'edge' };

export default function handler(req: Request): Promise<Response> {
  return handleNormals(new URL(req.url));
}
