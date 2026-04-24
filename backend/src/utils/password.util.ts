/**
 * Utilidades para manejo seguro de passwords con bcryptjs.
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Hashea una contraseña en texto plano */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compara una contraseña en texto plano contra un hash almacenado */
export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
