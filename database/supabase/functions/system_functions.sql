-- Verifica se o usuário é premium
CREATE OR REPLACE FUNCTION app_is_premium() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = app_current_user() AND plan = 'premium'
  );
END;
$$;
