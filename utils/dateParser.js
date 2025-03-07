const {
  parse,
  format,
  addDays,
  addWeeks,
  addMonths,
  addHours,
  isValid,
  isBefore,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  getDay,
  isWeekend,
  nextSaturday,
  setHours,
  setMinutes,
  setSeconds,
  parseISO,
} = require("date-fns");

/**
 * Parse natural language date expressions into valid date objects
 * @param {string} dateString - Natural language date string (e.g., "tomorrow", "next week")
 * @returns {Object} - Parsed date information
 */
function parseDate(dateString) {
  if (!dateString) return { success: false, message: "No date provided" };

  // Normalize input
  const input = dateString.toLowerCase().trim();
  const now = new Date();
  let result = null;

  // Common patterns
  if (input === "today") {
    result = now;
  } else if (input === "tomorrow") {
    result = addDays(now, 1);
  } else if (input === "day after tomorrow") {
    result = addDays(now, 2);
  } else if (input.match(/in\s+(\d+)\s+days?/)) {
    const days = parseInt(input.match(/in\s+(\d+)\s+days?/)[1]);
    result = addDays(now, days);
  } else if (input.match(/next\s+(\w+)/)) {
    const dayOrUnit = input.match(/next\s+(\w+)/)[1];

    // Handle "next week", "next month"
    if (dayOrUnit === "week") {
      result = addWeeks(now, 1);
    } else if (dayOrUnit === "month") {
      result = startOfMonth(addMonths(now, 1));
    }
    // Handle "next Monday", "next Tuesday", etc.
    else {
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayIndex = days.indexOf(dayOrUnit);

      if (dayIndex !== -1) {
        const currentDay = getDay(now);
        // Calculate days to add: if target day <= current day, add 7 + (target - current)
        // otherwise just add (target - current)
        const daysToAdd =
          dayIndex <= currentDay
            ? 7 + (dayIndex - currentDay)
            : dayIndex - currentDay;
        result = addDays(now, daysToAdd);
      }
    }
  } else if (input.match(/this\s+(\w+)/)) {
    const dayOrUnit = input.match(/this\s+(\w+)/)[1];

    if (dayOrUnit === "week") {
      result = endOfWeek(now);
    } else if (dayOrUnit === "weekend") {
      // If it's already the weekend, use today, otherwise find the next Saturday
      if (isWeekend(now)) {
        result = now;
      } else {
        result = nextSaturday(now);
      }
    } else {
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayIndex = days.indexOf(dayOrUnit);

      if (dayIndex !== -1) {
        const currentDay = getDay(now);

        if (dayIndex === currentDay) {
          // If it's already that day, use today
          result = now;
        } else if (dayIndex > currentDay) {
          // If the day is later in the week, go to that day
          result = addDays(now, dayIndex - currentDay);
        } else {
          // If the day has passed, go to next week's occurrence
          result = addDays(now, 7 - currentDay + dayIndex);
        }
      }
    }
  } else if (input === "weekend") {
    // If it's already the weekend, use today
    if (isWeekend(now)) {
      result = now;
    } else {
      result = nextSaturday(now);
    }
  } else if (input === "fortnight" || input === "in a fortnight") {
    result = addDays(now, 14);
  }
  // Try to parse as exact date
  else {
    // Try different formats with date-fns
    const formats = [
      "yyyy-MM-dd",
      "MM/dd/yyyy",
      "dd/MM/yyyy",
      "MMMM d",
      "MMMM d yyyy",
      "d MMMM",
      "d MMMM yyyy",
    ];

    for (const pattern of formats) {
      try {
        const parsed = parse(input, pattern, new Date());
        if (isValid(parsed)) {
          result = parsed;
          break;
        }
      } catch (e) {
        // Continue trying other formats
      }
    }

    // Try ISO format as fallback
    if (!result) {
      try {
        result = parseISO(input);
      } catch (e) {
        // Not an ISO format
      }
    }
  }

  // Ensure the date is valid and not in the past
  if (
    !result ||
    !isValid(result) ||
    isBefore(result, new Date().setHours(0, 0, 0, 0))
  ) {
    return {
      success: false,
      message: "Could not parse date or date is in the past",
    };
  }

  // Return formatted date and validation status
  return {
    success: true,
    date: format(result, "yyyy-MM-dd"),
    dayOfWeek: format(result, "EEEE"),
    formattedDate: format(result, "MMMM d, yyyy"),
    isoDate: result.toISOString(),
    dateObj: result,
  };
}

/**
 * Parse natural language time expressions into valid time string
 * @param {string} timeString - Natural language time string
 * @returns {Object} - Parsed time information
 */
function parseTime(timeString) {
  if (!timeString) return { success: false, message: "No time provided" };

  // Normalize input
  const input = timeString.toLowerCase().trim();
  const now = new Date();
  let result = null;

  // Common patterns
  if (input === "now") {
    result = now;
  } else if (input === "noon") {
    result = setHours(setMinutes(setSeconds(now, 0), 0), 12);
  } else if (input === "morning") {
    result = setHours(setMinutes(setSeconds(now, 0), 0), 9);
  } else if (input === "afternoon") {
    result = setHours(setMinutes(setSeconds(now, 0), 0), 14);
  } else if (input === "evening") {
    result = setHours(setMinutes(setSeconds(now, 0), 0), 18);
  } else if (input === "midnight") {
    // Set to midnight of the next day
    result = setHours(setMinutes(setSeconds(addDays(now, 1), 0), 0), 0);
  } else if (input.match(/in\s+(\d+)\s+hours?/)) {
    const hours = parseInt(input.match(/in\s+(\d+)\s+hours?/)[1]);
    result = addHours(now, hours);
  } else if (input.match(/(\d+)(?::(\d+))?\s*(am|pm)/)) {
    const matches = input.match(/(\d+)(?::(\d+))?\s*(am|pm)/);
    let hour = parseInt(matches[1]);
    const minute = matches[2] ? parseInt(matches[2]) : 0;
    const meridiem = matches[3].toLowerCase();

    // Convert to 24-hour format
    if (meridiem === "pm" && hour < 12) {
      hour += 12;
    } else if (meridiem === "am" && hour === 12) {
      hour = 0;
    }

    result = setHours(setMinutes(setSeconds(now, 0), minute), hour);
  } else if (input.match(/(\d+)(?::(\d+))?/)) {
    const matches = input.match(/(\d+)(?::(\d+))?/);
    const hour = parseInt(matches[1]);
    const minute = matches[2] ? parseInt(matches[2]) : 0;

    result = setHours(setMinutes(setSeconds(now, 0), minute), hour);

    // Assume PM for times between 1-6 without AM/PM specified
    if (hour >= 1 && hour <= 6) {
      result = setHours(result, hour + 12);
    }
  }

  // Try to parse standard time formats
  if (!result) {
    try {
      // Try "HH:mm" format
      result = parse(input, "HH:mm", new Date());
      if (!isValid(result)) {
        // Try "h:mm a" format (like "2:30 pm")
        result = parse(input, "h:mm a", new Date());
      }
      if (!isValid(result)) {
        // Try "h a" format (like "2 pm")
        result = parse(input, "h a", new Date());
      }
    } catch (e) {
      result = null;
    }
  }

  // Ensure the time is valid
  if (!result || !isValid(result)) {
    return {
      success: false,
      message: "Could not parse time",
    };
  }

  // Return formatted time and validation status
  return {
    success: true,
    time: format(result, "HH:mm"),
    formattedTime: format(result, "h:mm a"),
    isoTime: format(result, "HH:mm:ss"),
    dateObj: result,
  };
}

module.exports = {
  parseDate,
  parseTime,
};
