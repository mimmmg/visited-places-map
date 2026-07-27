/**
 * 엑셀 → 카페 행 파싱. PRD §5.1 (F-1).
 *
 * 첫 행이 헤더, 열은 이름 / 주소 / 카테고리. 첫 번째 시트만 읽는다.
 *
 * 셀은 반드시 **문자열**로 읽는다. 숫자·날짜 자동 변환이 주소를 망가뜨려
 * `(이름, 주소)` 키 매칭이 깨진다. (CLAUDE.md 흔한 실수)
 */

import * as XLSX from 'xlsx'
import type { CafeRow } from '@/types/cafe'
import { toCafeKey } from '@/lib/normalize'

/** 파일 크기 상한 5MB. (PRD §5.1) */
export const MAX_FILE_BYTES = 5 * 1024 * 1024
/** 행 수 상한 500행. (PRD F-1.7) */
export const MAX_ROWS = 500

/** 헤더 별칭. (PRD §5.1) */
const HEADER_ALIASES = {
  name: ['이름', '카페명', 'name'],
  address: ['주소', 'address', '소재지'],
  category: ['카테고리', 'category', '분류'],
} as const

export interface ParseCafeExcelResult {
  rows: CafeRow[]
  /** 이름/주소가 비어 제외된 행 번호. (PRD F-1.4) */
  skippedRowNumbers: number[]
  /** 파일 내 `(이름, 주소)` 중복으로 합쳐진 건수. (PRD F-1.5) */
  mergedDuplicateCount: number
  /** 엑셀에서 읽은 데이터 행 총계 (헤더 제외, 상한 적용 전). */
  totalRowCount: number
  /** 500행 상한을 넘겨 처리하지 않은 행 수. (PRD F-1.7) */
  droppedByLimitCount: number
}

export class CafeExcelError extends Error {}

/** BOM·공백 제거 후 소문자. 헤더 비교 전용. */
function normalizeHeader(value: string): string {
  return value.replace(/^﻿/, '').trim().toLowerCase()
}

/**
 * 헤더 행에서 각 열의 인덱스를 찾는다.
 * 필수 열(이름, 주소)이 없으면 어떤 열이 없는지 알려주며 실패한다. (PRD F-1.3)
 */
export function resolveHeaderIndexes(headerRow: string[]): {
  name: number
  address: number
  category: number
} {
  const headers = headerRow.map((cell) => normalizeHeader(String(cell ?? '')))

  const find = (aliases: readonly string[]) =>
    headers.findIndex((header) => aliases.some((alias) => header === alias.toLowerCase()))

  const name = find(HEADER_ALIASES.name)
  const address = find(HEADER_ALIASES.address)
  const category = find(HEADER_ALIASES.category)

  const missing: string[] = []
  if (name === -1) missing.push('이름')
  if (address === -1) missing.push('주소')

  if (missing.length > 0) {
    throw new CafeExcelError(
      `필수 열을 찾을 수 없습니다: ${missing.join(', ')}. 첫 줄에 이름·주소 열이 있는지 확인해 주세요.`,
    )
  }

  return { name, address, category }
}

/**
 * 시트 매트릭스(행 배열) → 카페 행 목록. 순수 함수라 테스트하기 쉽다.
 *
 * `matrix[0]` 은 헤더 행이고, 이후 행의 엑셀 행 번호는 `index + 2` 다.
 */
export function rowsFromMatrix(matrix: string[][]): ParseCafeExcelResult {
  if (matrix.length === 0) {
    throw new CafeExcelError('빈 파일입니다.')
  }

  const columns = resolveHeaderIndexes(matrix[0])
  const dataRows = matrix.slice(1)

  const rows: CafeRow[] = []
  const skippedRowNumbers: number[] = []
  const seen = new Map<string, CafeRow>()
  let mergedDuplicateCount = 0
  let totalRowCount = 0
  let droppedByLimitCount = 0

  for (let index = 0; index < dataRows.length; index += 1) {
    const raw = dataRows[index]
    const rowNumber = index + 2

    const name = String(raw[columns.name] ?? '').trim()
    const address = String(raw[columns.address] ?? '').trim()
    const category =
      columns.category === -1 ? '' : String(raw[columns.category] ?? '').trim()

    // 이름·주소가 모두 빈 행은 엑셀 하단의 빈 줄이므로 집계에서 제외한다.
    if (name === '' && address === '') continue

    totalRowCount += 1

    // 이름 또는 주소가 비었으면 건너뛰고 행 번호를 알린다. (PRD F-1.4)
    if (name === '' || address === '') {
      skippedRowNumbers.push(rowNumber)
      continue
    }

    // 파일 내 중복은 1건으로 합친다. (PRD F-1.5)
    const key = toCafeKey(name, address)
    if (seen.has(key)) {
      mergedDuplicateCount += 1
      continue
    }

    // 500행 상한. 초과분은 처리하지 않고 건수만 알린다. (PRD F-1.7)
    if (rows.length >= MAX_ROWS) {
      droppedByLimitCount += 1
      continue
    }

    const row: CafeRow = {
      rowNumber,
      name,
      address,
      category: category === '' ? undefined : category,
    }
    seen.set(key, row)
    rows.push(row)
  }

  return {
    rows,
    skippedRowNumbers,
    mergedDuplicateCount,
    totalRowCount,
    droppedByLimitCount,
  }
}

/** 워크북 바이트 → 카페 행 목록. 첫 번째 시트만 읽는다. */
export function parseCafeWorkbook(data: ArrayBuffer): ParseCafeExcelResult {
  const workbook = XLSX.read(data, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new CafeExcelError('시트를 찾을 수 없습니다.')
  }

  const sheet = workbook.Sheets[firstSheetName]

  // raw: false → 숫자·날짜를 서식 문자열로 받는다. defval: '' → 빈 셀을 빈 문자열로.
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })

  return rowsFromMatrix(matrix)
}

/** 업로드된 파일 → 카페 행 목록. (PRD F-1.1, F-1.2 — 브라우저에서 파싱) */
export async function parseCafeExcel(file: File): Promise<ParseCafeExcelResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new CafeExcelError(
      `파일이 너무 큽니다. 최대 5MB까지 올릴 수 있습니다. (현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`,
    )
  }

  const buffer = await file.arrayBuffer()
  return parseCafeWorkbook(buffer)
}
