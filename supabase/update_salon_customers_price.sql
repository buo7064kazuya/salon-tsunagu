CREATE OR REPLACE FUNCTION get_salon_customers(p_salon_id UUID)
RETURNS TABLE(
  name          TEXT,
  appt_date     DATE,
  appt_time     TEXT,
  menu_name     TEXT,
  menu_price    NUMERIC,
  age_group     TEXT,
  customer_type TEXT,
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  visit_count   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_email TEXT;
BEGIN
  SELECT au.email INTO caller_email FROM auth.users au WHERE au.id = auth.uid();
  IF caller_email IS DISTINCT FROM 'buo7064kazuya@gmail.com' THEN
    RAISE EXCEPTION 'Unauthorized: admin access only';
  END IF;

  RETURN QUERY
  SELECT
    c.name::TEXT,
    a.date::DATE                                                      AS appt_date,
    a.time::TEXT                                                      AS appt_time,
    COALESCE(m.name, '')::TEXT                                        AS menu_name,
    m.price::NUMERIC                                                  AS menu_price,
    COALESCE(c.age_group, '')::TEXT                                   AS age_group,
    CASE WHEN c.visit_count <= 1 THEN '新規' ELSE '継続' END::TEXT   AS customer_type,
    COALESCE(c.phone, '')::TEXT,
    COALESCE(c.email, '')::TEXT,
    COALESCE(c.notes, '')::TEXT,
    c.visit_count::INT
  FROM appointments a
  JOIN customers c ON a.customer_id = c.id AND c.salon_id = p_salon_id
  LEFT JOIN menus m ON a.menu_id = m.id
  WHERE a.salon_id = p_salon_id
    AND a.status != 'cancelled'
  ORDER BY a.date DESC, a.time DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_salon_customers(UUID) TO authenticated;
