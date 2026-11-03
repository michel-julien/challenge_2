export const users = new Map();
export const files = new Map();

export function publicUser(user) {
  if (!user) {
    return null;
  }

  const { password, ...profile } = user;
  return profile;
}
