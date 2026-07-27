/**
 * 검증용 샘플 엑셀 생성.  실행:  node scripts/make-samples.mjs
 *
 * samples/cafes-sample.xlsx        정상 5건
 * samples/cafes-with-bad.xlsx      정상 5건 + 가짜 주소 1건 (실패 목록 확인용)
 * samples/cafes-messy.xlsx         빈 행 / 중복 / 카테고리 누락 섞음
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const HEADER = ['이름', '주소', '카테고리']

const GOOD_ROWS = [
  ['덕수궁 로스터리', '서울 중구 세종대로 99', '로스터리'],
  ['을지로 디저트룸', '서울 중구 을지로 11', '디저트'],
  ['서울광장 작업실', '서울 중구 세종대로 110', '작업용'],
  ['명동 스탠드커피', '서울 중구 명동길 14', ''],
  ['북창동 커피가게', '서울 중구 남대문로1길 33', '로스터리'],
]

const BAD_ROW = ['뭉카페', '서울 어딘가 존재하지않는길 9999', '디저트']

function write(fileName, rows) {
  const sheet = XLSX.utils.aoa_to_sheet([HEADER, ...rows])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'cafes')
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })
  writeFileSync(`samples/${fileName}`, buffer)
  console.log(`samples/${fileName}  (데이터 ${rows.length}행)`)
}

mkdirSync('samples', { recursive: true })

write('cafes-sample.xlsx', GOOD_ROWS)
write('cafes-with-bad.xlsx', [...GOOD_ROWS, BAD_ROW])
write('cafes-messy.xlsx', [
  ...GOOD_ROWS,
  ['', '', ''], // 빈 행 → 집계 제외
  ['이름만 있는 카페', '', '디저트'], // 주소 누락 → 제외 + 행 번호 안내
  ['덕수궁 로스터리', '서울 중구 세종대로 99', '로스터리'], // 중복 → 1건으로 합침
  ['  덕수궁 로스터리  ', '서울 중구  세종대로 99', '로스터리'], // 공백 차이 → 같은 장소로 합침
])
