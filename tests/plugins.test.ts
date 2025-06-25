import { describe, it, expect, vi } from 'vitest';

import gsPlugin from '../src/tools/googleSheets';
import infoPlugin from '../src/tools/getSheetInfo';
import qbPlugin from '../src/tools/quickBooks';

// Mock data builders
const mockSheetData = {
  spreadsheetId: 'dummy',
  sheetName: 'Sheet1',
  range: 'A1:B2',
  headers: ['Name'],
  rows: [{ Name: 'Alice' }],
  totalRows: 1,
  queryInfo: { executedAt: new Date().toISOString() },
};

const mockSpreadsheetInfo = {
  title: 'Demo Sheet',
  spreadsheetId: 'dummy',
  sheets: [{ name: 'Sheet1', id: 0 }],
  totalSheets: 1,
};

const mockInvoiceData = {
  companyId: '123',
  invoices: [],
  totalCount: 0,
  queryInfo: { executedAt: new Date().toISOString() },
};

describe('Plugin architecture', () => {
  it('googleSheets plugin returns verbal response', async () => {
    const services: any = {
      googleSheets: {
        parseQuery: vi.fn().mockReturnValue({ spreadsheetId: 'dummy' }),
        getSheetData: vi.fn().mockResolvedValue(mockSheetData),
        formatForVerbalResponse: vi.fn().mockReturnValue('verbal'),
      },
    };

    const result: any = await gsPlugin.run({ query: 'test' }, { services });
    expect(result.verbalResponse).toBe('verbal');
    expect(services.googleSheets.parseQuery).toHaveBeenCalled();
  });

  it('getSheetInfo plugin returns spreadsheetInfo', async () => {
    const services: any = {
      googleSheets: {
        getSheetInfo: vi.fn().mockResolvedValue(mockSpreadsheetInfo),
      },
    };
    const result: any = await infoPlugin.run({ spreadsheetId: 'dummy' }, { services });
    expect(result.spreadsheetInfo.title).toBe('Demo Sheet');
  });

  it('quickBooks plugin formats invoice data', async () => {
    const services: any = {
      quickBooks: {
        parseQuery: vi.fn().mockReturnValue({}),
        searchInvoices: vi.fn().mockResolvedValue(mockInvoiceData),
        formatForVerbalResponse: vi.fn().mockReturnValue('invoices'),
      },
    };

    const result: any = await qbPlugin.run({ query: 'find invoices' }, { services });
    expect(result.verbalResponse).toBe('invoices');
    expect(services.quickBooks.parseQuery).toHaveBeenCalled();
  });

  it('googleSheets plugin throws on missing query', async () => {
    const services: any = { googleSheets: {} };
    await expect(gsPlugin.run({}, { services })).rejects.toThrow();
  });

  it('getSheetInfo plugin errors when spreadsheetId missing', async () => {
    const services: any = { googleSheets: {} };
    await expect(infoPlugin.run({}, { services })).rejects.toThrow('Spreadsheet ID is required');
  });

  it('quickBooks plugin errors if service not configured', async () => {
    const services: any = { };
    await expect(qbPlugin.run({ query: 'x' }, { services })).rejects.toThrow('QuickBooks service is not configured');
  });
});