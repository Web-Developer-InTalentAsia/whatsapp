-- Replace the phone number when required.
SELECT
  w.id,
  n.display_name,
  n.phone_number,
  w.name,
  w.trigger_keyword,
  w.start_mode,
  w.is_default,
  w.restart_on_closed_message,
  w.fallback_on_unmatched_message,
  w.is_active,
  jsonb_array_length(w.steps::jsonb) AS step_count
FROM workflows w
JOIN whatsapp_numbers n ON n.id = w.whatsapp_number_id
WHERE regexp_replace(n.phone_number, '\D', '', 'g') = '94777977478'
ORDER BY w.is_default DESC, w.id DESC;

-- Exactly one default workflow should exist for the selected line.
SELECT whatsapp_number_id, COUNT(*) AS default_count
FROM workflows
WHERE is_default = true
GROUP BY whatsapp_number_id
HAVING COUNT(*) <> 1;

-- Review the imported route tree.
SELECT
  w.id,
  step->>'id' AS step_id,
  step->>'type' AS step_type,
  step->>'questionText' AS message_text,
  step->'options' AS menu_options,
  step->>'nextStepId' AS next_step_id
FROM workflows w
CROSS JOIN LATERAL jsonb_array_elements(w.steps::jsonb) AS step
WHERE w.name = 'InTalent WhatsApp Main Menu'
ORDER BY w.id DESC, step->>'id';
