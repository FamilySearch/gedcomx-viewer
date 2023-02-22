function keyMirror(obj) {
  const val = {}
  Object.keys(obj).forEach(key => {
    val[key] = key
  })
  return val
}

const personParts = keyMirror({
  NAME: null,
  SURNAME: null
})

const factTypes = keyMirror({
  BIRTH: null,
  BIRTHREGISTRATION: null,
  BAPTISM: null,
  CHRISTENING: null,
  DEATH: null,
  DEATHREGISTRATION: null,
  BURIAL: null,
  OBITUARY: null,
  MARRIAGEREGISTRATION: null,
  MARRIAGE: null,
  MARITALSTATUS: null,
  RACE: null,
  OCCUPATION: null,
  NATIONALITY: null,
  RESIDENCE: null,
  CENSUS: null,
  OTHER: null,
  AGE: null,
  RELATIONSHIPTOHEAD: null,
  GENDER: null
})

const imageParts = keyMirror({
  IMAGEDIMS: null,
  IMAGESCORE: null
})

const relationshipTypes = keyMirror({
  PARENTCHILD: null,
  COUPLE: null
})

const factFieldKeys = keyMirror({
  DATE: null,
  PLACE: null,
  VALUE: null
})

const dataTypes = keyMirror({
  META: null,
  PERSON: null,
  RELATIONSHIPS: null
})

const allTypeList = [
  Object.keys(factTypes),
  Object.keys(relationshipTypes),
  Object.keys(factFieldKeys),
  Object.keys(personParts),
  Object.keys(imageParts),
  Object.keys(dataTypes)
].flat()

const factTypeList = Object.keys(factTypes)
const factFieldList = Object.keys(factFieldKeys)
const relationshipTypeList = Object.keys(relationshipTypes)
const personPartList = Object.keys(personParts)
const imagePartList = Object.keys(imageParts)

function splitOutBBox(str) {
  const rgx = /\[\[(?:(?!\]\]).)+\]\]/
  const bbox = str.match(rgx)
  const obj = { text: str.replace(bbox, '').trim() }
  if (bbox) {
    // console.log(bbox[0].replace(/'/g, '"'))
    obj.bbox = JSON.parse(bbox[0].replace(/'/g, '"'))
  }
  return obj 
}

function formModelFromBasic(lines) {
  const model = { records: [] }
  let record = null
  let newRecord = true

  lines.forEach(item => {
    const obj = {}
    
    switch(item.type) {
      case dataTypes.PERSON:
        if (newRecord) {
          record = { people: [], relationships: [] }
          model.records.push(record)
          newRecord = false
        }
        obj.id = item['ID']
        obj.name = {}
        Object.keys(item).filter(key => personPartList.includes(key)).forEach(personPartKey => {
          const personPart = splitOutBBox(item[personPartKey])
          if (personPartKey === personParts.NAME) obj.name.given = personPart
          if (personPartKey === personParts.SURNAME) obj.name.surname = personPart
          // if (personPartKey === personParts.GENDER) obj.gender = personPart
        })
        obj.facts = []
        Object.keys(item).filter(key => factTypeList.includes(key)).forEach(factType => {
          const fact = item[factType]
          const factObj = { type: factType }
          if (fact[factFieldKeys.DATE]) factObj.date = splitOutBBox(fact[factFieldKeys.DATE])
          if (fact[factFieldKeys.PLACE]) factObj.place = splitOutBBox(fact[factFieldKeys.PLACE])
          if (fact[factFieldKeys.VALUE]) factObj.value = splitOutBBox(fact[factFieldKeys.VALUE])
          if (!fact[factFieldKeys.DATE] && !fact[factFieldKeys.PLACE] && !fact[factFieldKeys.VALUE]) factObj.value = splitOutBBox(fact)
          obj.facts.push(factObj)
        })
        record.people.push(obj)
        break
  
      case dataTypes.RELATIONSHIPS:
        newRecord = true
        Object.keys(item).filter(key => relationshipTypeList.includes(key)).forEach(relType => {
          record.relationships.push({ type: relType, value: item[relType] })
        })
        break
  
      case dataTypes.META:
        obj.imageDimensions = JSON.parse(item[imageParts.IMAGEDIMS].replace(/\(/g, '[').replace(/\)/g, ']'))
        obj.imageScore = parseFloat(item[imageParts.IMAGESCORE])
        model.meta = obj
        break
    }
  })

  return model
}

function parseLineToBasic(line) {
  const tokens = line.split(' ')
  const type = tokens[0]
  const obj = { type }

  const keys = tokens.map((token, index) => {
    if (allTypeList.includes(token)) {
      return ({ key: token, index })
    }
    return null
  }).filter(x => x)

  keys.push({ key: 'END', index: tokens.length })
  
  let prevIndex = -1
  let prevKey = null
  let currentObj = null
  keys.forEach(item => {
    const { key, index } = item
    if (!prevKey) {
      prevKey = key
      prevIndex = index

      if (factTypeList.includes(key)) {
        currentObj = {}
        obj[prevKey] = currentObj
      }

      return
    }

    if (factTypeList.includes(prevKey) && factFieldList.includes(key)) {
      currentObj = {}
      obj[prevKey] = currentObj
      prevKey = key
      prevIndex = index
      return
    }
    
    if (factFieldList.includes(prevKey)) {
      currentObj[prevKey] = tokens.slice(prevIndex + 1, index).join(' ')
    } else {
      currentObj = null
      const value = tokens.slice(prevIndex + 1, index).join(' ')
      if (value) {
        obj[(prevKey === type) ? 'ID' : prevKey] = value
      }
    }

    prevKey = key
    prevIndex = index
  })

  return obj
}

function parseSummary(summary) {

  const lines = summary.split('\n').map(parseLineToBasic)
  // console.log(lines)
  const model = formModelFromBasic(lines)

  return model

}