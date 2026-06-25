import type { Express, Request, Response } from 'express';
import { getDb, type AppDatabase } from './db.js';
import { deleteUserFiles } from './fileStorage.js';
import { requirePlatformAdmin } from './platformAdmin.js';
import { deleteTheaterData } from './stateRepository.js';

export interface DeleteUserResult {
  deletedUserId: string;
  deletedTheaterIds: string[];
  deletedFilesCount: number;
}

export function deleteUserCompletely(
  userId: string,
  db: AppDatabase = getDb()
): DeleteUserResult | null {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as
    | { id: string }
    | undefined;
  if (!user) return null;

  const ownedTheaters = db
    .prepare('SELECT id FROM theaters WHERE owner_user_id = ?')
    .all(userId) as Array<{ id: string }>;

  let deletedFilesCount = 0;

  const tx = db.transaction(() => {
    for (const theater of ownedTheaters) {
      deleteTheaterData(db, theater.id);
    }
    deletedFilesCount = deleteUserFiles(db, userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  tx();

  return {
    deletedUserId: userId,
    deletedTheaterIds: ownedTheaters.map((theater) => theater.id),
    deletedFilesCount,
  };
}

export function registerAdminDeleteUserRoutes(app: Express) {
  app.delete('/api/admin/users/:userId', (req: Request, res: Response) => {
    const session = requirePlatformAdmin(req, res);
    if (!session) return;

    const { userId } = req.params;
    if (userId === session.user.id) {
      res.status(400).json({ error: 'CANNOT_DELETE_SELF' });
      return;
    }

    try {
      const result = deleteUserCompletely(userId);
      if (!result) {
        res.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      console.info(
        `[admin] deleted user ${userId} by ${session.user.email}: ${result.deletedTheaterIds.length} theaters, ${result.deletedFilesCount} files`
      );
      res.json(result);
    } catch (error) {
      console.error('[admin] delete user failed', error);
      res.status(500).json({ error: 'DELETE_USER_FAILED' });
    }
  });
}
