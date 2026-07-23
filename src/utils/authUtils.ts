import { getLogger } from "@logtape/logtape";
import { Octokit } from "@octokit/rest";

import { GIST_ID, GIST_TOKEN } from "../config";

const logger = getLogger(["RM6785Bot", "utils", "authUtils"]);

const octokit = new Octokit({ auth: GIST_TOKEN });

interface AuthorizedUser {
  id: number;
  name: string;
}

export const getAuthorizedUsers = async (): Promise<AuthorizedUser[]> => {
  try {
    const { data } = await octokit.gists.get({ gist_id: GIST_ID });
    const { files } = data;

    if (files && "auth.json" in files) {
      const gistFile = files["auth.json"];
      if (gistFile && gistFile.content && gistFile.content.trim().length > 0) {
        const users = JSON.parse(gistFile.content) as AuthorizedUser[];
        logger.debug(
          `getAuthorizedUsers: loaded ${users.length} users from gist`,
        );
        return users;
      }
    }

    logger.warn("getAuthorizedUsers: auth.json missing/empty, using fallback");
    return [{ id: 1138003186, name: "SamarV-121" }];
  } catch (error) {
    logger.error(
      `getAuthorizedUsers: error fetching gist: ${(error as Error).message}`,
    );
    return [];
  }
};

export const uploadAuthorizedUsers = async (
  jsonData: AuthorizedUser[],
): Promise<string | false> => {
  try {
    const { data } = await octokit.gists.update({
      gist_id: GIST_ID,
      files: {
        "auth.json": {
          content: JSON.stringify(jsonData, null, 2),
        },
      },
    });
    logger.debug(
      `uploadAuthorizedUsers: uploaded ${jsonData.length} users to gist`,
    );
    return data.id as string;
  } catch (error) {
    logger.error(
      `uploadAuthorizedUsers: error uploading gist: ${(error as Error).message}`,
    );
    return false;
  }
};

export const addAuthorizedUser = async (user: {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}): Promise<boolean> => {
  const authorizedUsers = await getAuthorizedUsers();

  if (authorizedUsers.some((u) => u.id === user.id)) {
    return false;
  }

  authorizedUsers.push({
    id: user.id,
    name: user.username || `${user.first_name} ${user.last_name || ""}`,
  });

  const uploadResult = await uploadAuthorizedUsers(authorizedUsers);
  return uploadResult !== false;
};

export const removeAuthorizedUser = async (
  userId: number,
): Promise<boolean> => {
  const authorizedUsers = await getAuthorizedUsers();

  const index = authorizedUsers.findIndex((u) => u.id === userId);

  if (index === -1) {
    return false;
  }

  authorizedUsers.splice(index, 1);

  const uploadResult = await uploadAuthorizedUsers(authorizedUsers);
  return uploadResult !== false;
};

export const isAuthorized = async (userId: number): Promise<boolean> => {
  const authorizedUsers = await getAuthorizedUsers();
  return authorizedUsers.some((u) => u.id === userId);
};
