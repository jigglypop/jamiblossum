use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

const KOREA_TIME_CORRECTION_MINUTES: i32 = -30;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizeRequest {
    pub calendar: Option<String>,
    pub date: String,
    pub gender: String,
    pub time: Option<String>,
    pub time_index: Option<i32>,
    pub language: Option<String>,
    pub is_leap_month: Option<bool>,
    pub fix_leap: Option<bool>,
    pub flow_date: Option<String>,
    pub flow_time: Option<String>,
    pub flow_time_index: Option<i32>,
    pub zi_time_mode: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedRequest {
    pub calendar: String,
    pub date: String,
    pub gender: String,
    pub time_index: i32,
    pub hour: i32,
    pub minute: i32,
    pub language: String,
    pub is_leap_month: bool,
    pub fix_leap: bool,
    pub flow_date: String,
    pub flow_time_index: i32,
    pub flow_hour: i32,
    pub flow_minute: i32,
    pub zi_time_mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Surrounded {
    pub self_index: usize,
    pub trine: [usize; 2],
    pub opposite: usize,
}

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[wasm_bindgen(js_name = normalizeRequestJson)]
pub fn normalize_request_json(payload: &str) -> Result<String, JsValue> {
    let request: NormalizeRequest =
        serde_json::from_str(payload).map_err(|err| JsValue::from_str(&err.to_string()))?;
    let normalized = normalize_request(request)?;
    serde_json::to_string(&normalized).map_err(|err| JsValue::from_str(&err.to_string()))
}

#[wasm_bindgen(js_name = surroundedJson)]
pub fn surrounded_json(palace_count: usize) -> Result<String, JsValue> {
    if palace_count == 0 {
        return Ok("[]".to_string());
    }

    let surrounded: Vec<Surrounded> = (0..palace_count)
        .map(|index| Surrounded {
            self_index: index,
            trine: [(index + 4) % palace_count, (index + 8) % palace_count],
            opposite: (index + 6) % palace_count,
        })
        .collect();

    serde_json::to_string(&surrounded).map_err(|err| JsValue::from_str(&err.to_string()))
}

fn normalize_request(request: NormalizeRequest) -> Result<NormalizedRequest, JsValue> {
    let calendar = match request.calendar.as_deref() {
        Some("lunar") => "lunar",
        _ => "solar",
    }
    .to_string();

    let date = normalize_date(&request.date);
    if !is_valid_date(&date, calendar == "lunar") {
        return Err(JsValue::from_str("date must be a valid YYYY-M-D date"));
    }

    let gender = normalize_gender(&request.gender)?;
    let mut hour = 12;
    let mut minute = 0;
    let mut time_index = request.time_index;
    let mut calc_date = date.clone();

    if time_index.is_none() {
        if let Some(value) = request.time.as_deref() {
            let (parsed_hour, parsed_minute) = parse_time(value)?;
            let shifted = shift_date_time(&date, parsed_hour, parsed_minute, KOREA_TIME_CORRECTION_MINUTES)?;
            calc_date = shifted.date;
            hour = shifted.hour;
            minute = shifted.minute;
            time_index = Some(time_to_index(hour));
        }
    } else if let Some(index) = time_index {
        if index == 0 {
            hour = 0;
            minute = 0;
        } else if index == 12 {
            hour = 23;
            minute = 0;
        } else {
            hour = (index - 1) * 2 + 1;
            minute = 0;
        }
    }

    let time_index = time_index.unwrap_or(6);
    if !(0..=12).contains(&time_index) {
        return Err(JsValue::from_str("timeIndex must be 0..12"));
    }

    let flow_date = request.flow_date.as_deref().map(normalize_date).unwrap_or_default();
    if !flow_date.is_empty() && !is_valid_date(&flow_date, false) {
        return Err(JsValue::from_str("flowDate must be a valid YYYY-M-D date"));
    }

    let mut flow_hour = 0;
    let mut flow_minute = 0;
    let mut flow_time_index = request.flow_time_index;
    let mut calc_flow_date = flow_date;

    if flow_time_index.is_none() {
        if let Some(value) = request.flow_time.as_deref() {
            let (parsed_hour, parsed_minute) = parse_time(value)?;
            let base_date = if calc_flow_date.is_empty() { &date } else { &calc_flow_date };
            let shifted = shift_date_time(
                base_date,
                parsed_hour,
                parsed_minute,
                KOREA_TIME_CORRECTION_MINUTES,
            )?;
            calc_flow_date = shifted.date;
            flow_hour = shifted.hour;
            flow_minute = shifted.minute;
            flow_time_index = Some(time_to_index(flow_hour));
        }
    }

    let flow_time_index = flow_time_index.unwrap_or(0);
    if !(0..=12).contains(&flow_time_index) {
        return Err(JsValue::from_str("flowTimeIndex must be 0..12"));
    }

    Ok(NormalizedRequest {
        calendar,
        date: calc_date,
        gender,
        time_index,
        hour,
        minute,
        language: request.language.unwrap_or_else(|| "ko-KR".to_string()),
        is_leap_month: request.is_leap_month.unwrap_or(false),
        fix_leap: request.fix_leap.unwrap_or(true),
        flow_date: calc_flow_date,
        flow_time_index,
        flow_hour,
        flow_minute,
        zi_time_mode: match request.zi_time_mode.as_deref() {
            Some("fixed") => "fixed",
            _ => "split",
        }
        .to_string(),
    })
}

struct ShiftedDateTime {
    date: String,
    hour: i32,
    minute: i32,
}

fn normalize_date(value: &str) -> String {
    let trimmed = value.trim();
    let parts: Vec<&str> = trimmed.split('/').collect();
    if parts.len() == 3 {
        if let (Ok(month), Ok(day), Ok(year)) = (
            parts[0].parse::<i32>(),
            parts[1].parse::<i32>(),
            parts[2].parse::<i32>(),
        ) {
            return format!("{}-{}-{}", year, month, day);
        }
    }
    trimmed.to_string()
}

fn is_valid_date(value: &str, lunar: bool) -> bool {
    let parts: Vec<&str> = value.split('-').collect();
    if parts.len() != 3 {
        return false;
    }
    let Ok(year) = parts[0].parse::<i32>() else {
        return false;
    };
    let Ok(month) = parts[1].parse::<i32>() else {
        return false;
    };
    let Ok(day) = parts[2].parse::<i32>() else {
        return false;
    };
    if !(100..=2200).contains(&year) || !(1..=12).contains(&month) || day < 1 {
        return false;
    }
    if lunar {
        day <= 30
    } else {
        days_in_month(year, month).is_ok_and(|days| day <= days)
    }
}

fn normalize_gender(value: &str) -> Result<String, JsValue> {
    match value.trim().to_lowercase().as_str() {
        "m" | "male" | "man" | "남" | "남자" | "남성" | "男" => Ok("male".to_string()),
        "f" | "female" | "woman" | "여" | "여자" | "여성" | "女" => Ok("female".to_string()),
        _ => Err(JsValue::from_str("gender must be male/female or 남/여")),
    }
}

fn parse_time(value: &str) -> Result<(i32, i32), JsValue> {
    let trimmed = value.trim();
    let (time_part, suffix) = split_time_suffix(trimmed);
    let parts: Vec<&str> = time_part.split(':').collect();
    if parts.len() < 2 {
        return Err(JsValue::from_str("time must be HH:MM"));
    }

    let mut hour = parts[0]
        .parse::<i32>()
        .map_err(|_| JsValue::from_str("hour must be 0..23"))?;
    let minute = parts[1]
        .parse::<i32>()
        .map_err(|_| JsValue::from_str("minute must be 0..59"))?;

    match suffix.as_deref() {
        Some("pm") | Some("오후") if hour < 12 => hour += 12,
        Some("am") | Some("오전") if hour == 12 => hour = 0,
        _ => {}
    }

    if !(0..=23).contains(&hour) {
        return Err(JsValue::from_str("hour must be 0..23"));
    }
    if !(0..=59).contains(&minute) {
        return Err(JsValue::from_str("minute must be 0..59"));
    }

    Ok((hour, minute))
}

fn split_time_suffix(value: &str) -> (String, Option<String>) {
    let lower = value.to_lowercase();
    if lower.ends_with("am") || lower.ends_with("pm") {
        return (value[..value.len() - 2].trim().to_string(), Some(lower[value.len() - 2..].to_string()));
    }

    let parts: Vec<&str> = value.split_whitespace().collect();
    if parts.len() >= 2 {
        if parts[0].contains(':') {
            return (parts[0].to_string(), Some(parts[parts.len() - 1].to_lowercase()));
        }
        if parts[parts.len() - 1].contains(':') {
            return (
                parts[parts.len() - 1].to_string(),
                Some(parts[0].to_lowercase()),
            );
        }
    }

    (value.to_string(), None)
}

fn shift_date_time(
    date: &str,
    hour: i32,
    minute: i32,
    delta_minutes: i32,
) -> Result<ShiftedDateTime, JsValue> {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return Err(JsValue::from_str("date must be YYYY-M-D"));
    }
    let year = parts[0].parse::<i32>().map_err(|_| JsValue::from_str("invalid year"))?;
    let month = parts[1].parse::<i32>().map_err(|_| JsValue::from_str("invalid month"))?;
    let day = parts[2].parse::<i32>().map_err(|_| JsValue::from_str("invalid day"))?;

    let mut total = hour * 60 + minute + delta_minutes;
    let mut day_delta = 0;
    while total < 0 {
        total += 24 * 60;
        day_delta -= 1;
    }
    while total >= 24 * 60 {
        total -= 24 * 60;
        day_delta += 1;
    }

    let (shifted_year, shifted_month, shifted_day) = shift_day(year, month, day, day_delta)?;

    Ok(ShiftedDateTime {
        date: format!("{}-{}-{}", shifted_year, shifted_month, shifted_day),
        hour: total / 60,
        minute: total % 60,
    })
}

fn shift_day(year: i32, month: i32, day: i32, delta: i32) -> Result<(i32, i32, i32), JsValue> {
    let mut year = year;
    let mut month = month;
    let mut day = day + delta;

    loop {
        let days = days_in_month(year, month)?;
        if day < 1 {
            month -= 1;
            if month < 1 {
                month = 12;
                year -= 1;
            }
            day += days_in_month(year, month)?;
        } else if day > days {
            day -= days;
            month += 1;
            if month > 12 {
                month = 1;
                year += 1;
            }
        } else {
            return Ok((year, month, day));
        }
    }
}

fn days_in_month(year: i32, month: i32) -> Result<i32, JsValue> {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => Ok(31),
        4 | 6 | 9 | 11 => Ok(30),
        2 if is_leap_year(year) => Ok(29),
        2 => Ok(28),
        _ => Err(JsValue::from_str("invalid month")),
    }
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn time_to_index(hour: i32) -> i32 {
    if hour == 0 {
        0
    } else if hour == 23 {
        12
    } else {
        (hour + 1) / 2
    }
}
