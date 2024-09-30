

/**
 * Methods for record identifiers used in PALs and ARKs.
 */

const J_ENCODING = {
  SEPARATOR: '-',
  ALPHABET: 'M9S3Q7W4HCZ8D6XFNJVK2LGP5RTYB1',
  get ALPHABET_REG() {
    return new RegExp(`[^${this.ALPHABET}]`, 'gi')
  },
  get NUMBER_BASE() {
    return this.ALPHABET.length
  },
  MIN_DIGITS: 7,
}

/**
 * JDecode a JEncoded value (string to be converted back to number) ('-' characters are insignificant and will be ignored)
 *
 * @param {String} encodedId the encoded id
 * @param {Boolean} [strict] enforce a properly-formed encoded value with '-' separators in the right places and no extraneous
 *                  characters (optional)
 * @returns {Number} the number value
 * @throws Error if the encodedId is not a string or if strict is not a boolean
 */
function decode(encodedId, strict = false) {
  if (typeof encodedId !== 'string') {
    throw new Error(`encodedId is not a string: ${encodedId}`)
  }

  if (typeof strict !== 'boolean') {
    throw new Error(`strict is not a boolean: ${strict}`)
  }

  return decodeString(encodedId, strict)
}

/**
 * JEncode an id (number)
 *
 * @param {Number} entityValue the id
 * @returns {String} the encoded id
 * @throws Error if the entityValue is not a number
 */
function jencode(entityValue) {
  if (typeof entityValue !== 'number') {
    throw new Error(`entityValue is not a number: ${entityValue}`)
  }

  return insertSeperators(encodeValue(entityValue, J_ENCODING.MIN_DIGITS))
}

/**
 * JEncode an ARK name from the identifier
 *
 * @param {String} id the identifier; e.g. TH-266-11581-156300-19 OR DGS-004764177_00057
 * @returns {String} the encoded ark type and ID (e.g. 3:1:xxxx or 3:2:xxxx)
 * @throws Error if the identifier is formed wrong or has illegal characters
 */
function encodeArk(id) {
  if (id) {
    const dgsParts = id.match(/DGS-(\d{9})_(\d{5})/)
    if (dgsParts) {
      // DGS-004764177_00057 should return 3:2:77T6-FY9Y
      dgsParts[1] = encodeValue(parseInt(dgsParts[1], 10), 1)
      dgsParts[2] = encodeValue(parseInt(dgsParts[2], 10), 1)
      const len = encodeValue(parseInt(dgsParts[1].length, 10), 1)
      return `3:2:${insertSeperators([len, dgsParts[1], dgsParts[2]].join(''))}`
    }
  }

  const numberParts = id.split(J_ENCODING.SEPARATOR)

  if (!numberParts || numberParts.length < 3) {
    throw new Error(`Invalid identifier: ${id}`)
  }
  numberParts.shift()
  numberParts.pop()
  for (let i = 0; i < numberParts.length; ++i) {
    numberParts[i] = encodeValue(parseInt(numberParts[i], 10), 1)
  }

  const len1 = encodeValue(numberParts[0].length, 1)
  const len2 = encodeValue(numberParts[1].length, 1)
  numberParts.unshift(len1 + len2)

  return `3:1:${insertSeperators(numberParts.join(''))}`
}

// Convert a number to a correctly formatted JID.
// Convert a JID (Correctly or incorrectly formatted) to a correctly formatted JID
function prepareIdForUse(entityValue) {
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(entityValue)) {
    return tryFormatPID(entityValue)
  }

  return jencode(entityValue)
}

// ===========================================================================
// Internal Functions
// ===========================================================================

/**
 * This just parses the string as a base 30 number (or base 10 if all digits) and returns the idValue.
 * if "strict" = true, then checks for '-' characters separating every 4 trigits.
 *
 * @param {String} s the encoded value
 * @param {Boolean} strict true if encoded value must have '-' characters separating every 4 digits
 * @returns {Number} long idValue
 * @throws Error if string value is too short or missing the '-' character
 */
function decodeString(s, strict) {
  /**
   * The string might be all digits.  If so, we want to interpret this as a base 10 number.
   * The reason for this is to support backward compatibility to the .9 code base where it was
   * common to have a domain name such as p. followed by a base 10 ascii string.  These encodings
   * were very common in places such as LTV.  This is only one of several possible ways to handle
   * this, but note that all id values in the new encoding must have a SEPARATOR character in them
   * to be valid.  So all we have to do is look for a string that has no SEPARATOR character and
   * that has only numeric values, then decode as a base 10 ascii number.
   */
  // Determine base 10 or base 31.
  if (Number.isNaN(s)) {
    // must not have any occurrences of SEPARATOR && must be all digits.
    // actually it's sufficient to just say it's all digits.
    return Number(s)
  }
  if (strict && s.length < J_ENCODING.MIN_DIGITS) {
    throw new Error(`Value is too short: ${s}`)
  }
  let result = 0
  // Assume new base 31 encoding
  // Now walk through and decode the characters.
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i)
    const nextVal = J_ENCODING.ALPHABET.indexOf(ch)
    if (nextVal !== -1) {
      if (strict && (i + 1) % 5 === 0) {
        throw new Error(`Missing '-' in value: ${s}[${i}]`)
      }
      result *= J_ENCODING.NUMBER_BASE // prepare the accumulator
      result += nextVal // add in the current idValue.
    } else if (strict) {
      if (ch !== J_ENCODING.SEPARATOR) {
        throw new Error(`Unexpected character '${ch}' in value: ${s}`)
      }
      if ((i + 1) % 5 !== 0) {
        throw new Error(`Improperly formed value: ${s}`)
      }
    }
    // skip invalid characters
  }
  return result
}

/**
 * This encodes a idValue with optional padding.
 *
 * @param {Number} value the long value
 * @param {Number} padWidth - 0 means no padding
 * @returns {String} encoded string
 * @throws Error if the value has characters that are illegal
 */
function encodeValue(value, padWidth) {
  let sb = ''
  let nextVal
  while (value > 0) {
    nextVal = Math.floor(value % J_ENCODING.NUMBER_BASE)
    sb += getEncodedChar(nextVal)
    value = Math.floor(value / J_ENCODING.NUMBER_BASE)
  }
  // Now we need to append enough encoded 0s to fill it up.
  while (sb.length < padWidth) {
    sb += getEncodedChar(0)
  }
  return reverse(sb)
}

/**
 * Determine the encoded character for the idValue val.
 * Note that val must be within legal limits or getEncodedChar throws an exception.
 *
 * @param {Number} val the value to use as an index into the ALPHABET
 * @return {String} encoded character for val
 * @throws Error if the value is not a legal characters
 */
function getEncodedChar(val) {
  if (val < 0 || val >= J_ENCODING.NUMBER_BASE) {
    throw new Error(`Illegal encoding idValue: ${val}`)
  }
  return J_ENCODING.ALPHABET.charAt(val)
}

/**
 * Insert a string into the middle of another at a given index.
 * @param {Number} idx The index into the string for the insertion.
 * @param {String} s The original string
 * @param {String} insert The string to be inserted at s[idx]
 * @returns {String} The resulting string
 */
function insertString(idx, s, insert) {
  return `${s.substring(0, idx)}${insert}${s.substring(idx)}`
}

/**
 * Insert the SEPARATOR into the string at the proper location.
 * @param {String} sb The string to be adjusted
 * @returns {String} The string with the appropriate SEPARATOR inserted
 */
function insertSeperators(sb) {
  if (sb !== null && sb.length > 0) {
    // Separators go after of each set of 4 characters.
    for (let insertionPoint = 4; insertionPoint < sb.length; insertionPoint += 4 + 1) {
      sb = insertString(insertionPoint, sb, J_ENCODING.SEPARATOR)
    }
  }
  return sb
}

/**
 * Reverse the characters in a string
 * @param {String} s The string to be reversed
 * @return The reversed version of the string
 */
function reverse(s) {
  return s.split('').reverse().join('')
}

/**
 * Strip improper characters from a JID and correctly format it.
 * @param {String} id The id string to be formatted.
 * @return {String} The formatted string
 */
function tryFormatPID(id) {
  id = (id || '').replace(J_ENCODING.ALPHABET_REG, '').toUpperCase()
  while (id.length < J_ENCODING.MIN_DIGITS) {
    id = J_ENCODING.ALPHABET[0] + id
  }
  return insertSeperators(id)
}