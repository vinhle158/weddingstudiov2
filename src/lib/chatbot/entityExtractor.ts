import { ExtractedEntities, Intent } from './types';

// Normalizer helper (strips accents for easier relative word matching)
function normalizeText(text: string): string {
  let str = text.toLowerCase().trim();
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/đ/g, 'd');
  return str;
}

export async function extractEntities(message: string, intent: Intent): Promise<ExtractedEntities> {
  const entities: ExtractedEntities = {};
  const lowerMessage = message.toLowerCase().trim();
  const normalized = normalizeText(message);

  // 1. Extract Order Code (e.g. HĐ-2026-0001)
  const orderCodeRegex = /(?:mã\s*đơn|đơn\s*hàng|hợp\s*đồng|hđ)\s*#?([A-Za-z0-9\-]+)/i;
  const orderCodeMatch = message.match(orderCodeRegex);
  if (orderCodeMatch) {
    const code = orderCodeMatch[1].trim();
    if (code.length > 2) {
      entities.orderCode = code;
    }
  }

  // 2. Extract Month & Year
  const monthYearRegex = /tháng\s*(\d{1,2})(?:\s*(?:năm|\/)\s*(\d{4}))?/i;
  const monthYearMatch = message.match(monthYearRegex);
  if (monthYearMatch) {
    entities.month = parseInt(monthYearMatch[1], 10);
    if (monthYearMatch[2]) {
      entities.year = parseInt(monthYearMatch[2], 10);
    }
  }

  // 3. Extract Quarter
  const quarterRegex = /quý\s*([1-4])(?:\s*(?:năm|\/)\s*(\d{4}))?/i;
  const quarterMatch = message.match(quarterRegex);
  if (quarterMatch) {
    entities.quarter = parseInt(quarterMatch[1], 10);
    if (quarterMatch[2]) {
      entities.year = parseInt(quarterMatch[2], 10);
    }
  }

  // 4. Extract Year alone
  const yearRegex = /năm\s*(\d{4})/i;
  const yearMatch = message.match(yearRegex);
  if (yearMatch && !entities.year) {
    entities.year = parseInt(yearMatch[1], 10);
  }

  // 5. Extract Limit (e.g. top 5, 5 việc, limit 10)
  const limitMatch = normalized.match(/top\s*(\d+)/i) || 
                     normalized.match(/limit\s*(\d+)/i) || 
                     normalized.match(/(\d+)\s*(khach|don|lead|task|nguoi|viec|nhan su|nhan vien)/i);
  if (limitMatch) {
    entities.limit = parseInt(limitMatch[1], 10);
  } else {
    entities.limit = 5; // Default limit
  }

  // 6. Relative range extraction (today, tomorrow, this week, next week)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  if (normalized.includes('ngay mai') || normalized.includes('mai')) {
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    entities.dateFrom = `${tomorrowStr}T00:00:00.000Z`;
    entities.dateTo = `${tomorrowStr}T23:59:59.999Z`;
  } else if (normalized.includes('tuan nay')) {
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
    const start = new Date(today);
    start.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    entities.dateFrom = `${start.toISOString().split('T')[0]}T00:00:00.000Z`;
    entities.dateTo = `${end.toISOString().split('T')[0]}T23:59:59.999Z`;
  } else if (normalized.includes('tuan sau')) {
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    entities.dateFrom = `${start.toISOString().split('T')[0]}T00:00:00.000Z`;
    entities.dateTo = `${end.toISOString().split('T')[0]}T23:59:59.999Z`;
  } else if (normalized.includes('hom nay') || lowerMessage.includes('nay')) {
    entities.dateFrom = `${todayStr}T00:00:00.000Z`;
    entities.dateTo = `${todayStr}T23:59:59.999Z`;
  }

  // 7. Default Time Range for Statistical Intent (if not explicitly extracted)
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed

  if (lowerMessage.includes('tháng này') || lowerMessage.includes('tháng hiện tại')) {
    entities.month = currentMonth;
    entities.year = currentYear;
  } else if (lowerMessage.includes('tháng trước')) {
    entities.month = currentMonth === 1 ? 12 : currentMonth - 1;
    entities.year = currentMonth === 1 ? currentYear - 1 : currentYear;
  }

  if (lowerMessage.includes('quý này') || lowerMessage.includes('quý hiện tại')) {
    entities.quarter = Math.ceil(currentMonth / 3);
    entities.year = currentYear;
  } else if (lowerMessage.includes('quý trước')) {
    const currentQuarter = Math.ceil(currentMonth / 3);
    entities.quarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
    entities.year = currentQuarter === 1 ? currentYear - 1 : currentYear;
  }

  if (lowerMessage.includes('năm nay') || lowerMessage.includes('năm hiện tại')) {
    entities.year = currentYear;
  } else if (lowerMessage.includes('năm ngoái') || lowerMessage.includes('năm trước')) {
    entities.year = currentYear - 1;
  }

  // Fallback default years for month/quarter
  if ((entities.month || entities.quarter) && !entities.year) {
    entities.year = currentYear;
  }

  // 7.5. Extract Priority filter
  if (normalized.includes('khan cap') || normalized.includes('gap') || normalized.includes('khan_cap')) {
    entities.priority = 'high';
  } else if (normalized.includes('thuong') || normalized.includes('binh thuong')) {
    entities.priority = 'normal';
  }

  // 8. Extract Customer Name (for CUSTOMER_LIST & CONTRACT_STATUS)
  if (intent === 'CUSTOMER_LIST' || intent === 'CONTRACT_STATUS') {
    const prefixes = [
      'tra cứu thông tin khách hàng',
      'thông tin chi tiết khách hàng',
      'thông tin khách hàng',
      'tìm kiếm khách hàng',
      'hồ sơ khách hàng',
      'thông tin liên hệ của',
      'cho tôi thông tin của',
      'xem thông tin khách',
      'hợp đồng của khách',
      'trạng thái hợp đồng của',
      'kiểm tra trạng thái hợp đồng',
      'hợp đồng cưới của',
      'đơn hàng của khách',
      'đơn hàng của',
      'tình hình hợp đồng của',
      'tìm khách hàng',
      'thông tin của',
      'kiểm tra hợp đồng',
      'hợp đồng',
      'đơn hàng',
      'tìm kiếm',
      'khách hàng',
      'của',
      'tìm sđt',
      'cho xin thông tin',
      'ai là',
      'xem',
      'tìm'
    ];

    let cleaned = message.trim();
    let foundPrefix = false;

    for (const prefix of prefixes) {
      const regex = new RegExp(`^\\s*${prefix}\\s+`, 'i');
      if (regex.test(cleaned)) {
        cleaned = cleaned.replace(regex, '');
        foundPrefix = true;
        break;
      }
    }

    const suffixes = [
      'trạng thái thế nào',
      'trạng thái sao rồi',
      'thế nào rồi',
      'sao rồi',
      'ở đâu',
      'là ai'
    ];
    for (const suffix of suffixes) {
      const regex = new RegExp(`\\s+${suffix}\\s*\\??$`, 'i');
      cleaned = cleaned.replace(regex, '');
    }

    cleaned = cleaned.replace(/[?.!]+$/, '').trim();

    if (foundPrefix && cleaned.length > 0) {
      entities.customerName = cleaned;
    } else {
      const words = message.trim().split(/\s+/);
      if (words.length <= 3 && !lowerMessage.includes('tìm') && !lowerMessage.includes('hợp đồng') && !lowerMessage.includes('doanh số') && !lowerMessage.includes('công việc')) {
        entities.customerName = message.replace(/[?.!]+$/, '').trim();
      } else {
        const match = message.match(/(?:của|khách hàng|tìm|hđ)\s+([^?.!]+)/i);
        if (match) {
          entities.customerName = match[1].replace(new RegExp(`(?:${suffixes.join('|')})`, 'i'), '').replace(/[?.!]+$/, '').trim();
        }
      }
    }
  }

  return entities;
}
