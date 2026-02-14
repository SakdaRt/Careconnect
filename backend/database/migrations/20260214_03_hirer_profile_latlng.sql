-- Add lat/lng columns to hirer_profiles for persisting Google Maps location
ALTER TABLE hirer_profiles ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE hirer_profiles ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
