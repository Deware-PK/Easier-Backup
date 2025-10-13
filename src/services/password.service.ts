import bcrypt from "bcryptjs";

// Determine the complexity of the encryption (8-12 is recommended!)
const saltRounds = 8;

/**
 * Parsing plain password to Hash
 * @param plainPassword
 * @returns {Promise<String>} hash password
 */
export const hashPassword = async (plainPassword: string): Promise<String> => {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(plainPassword, salt);
    return hash;
}

/**
 * Compare plain password with hash
 * @param plainPassword
 * @param hash
 * @returns {Promise<boolean>} - return true if password correct
 */
export const comparePassword = async (plainPassword: string, hash: string): Promise<Boolean> => {
    const isMatch = await bcrypt.compare(plainPassword, hash);
    return isMatch;
}
