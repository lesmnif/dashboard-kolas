-- Create batch_strains table for handling multiple strains per batch
-- This table allows you to assign multiple strains to a single batch
-- with specific light assignments and room percentages

CREATE TABLE public.batch_strains (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  strain_id uuid NOT NULL,
  lights_assigned integer NOT NULL DEFAULT 0,
  percentage numeric(5,2) NOT NULL DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT batch_strains_pkey PRIMARY KEY (id),
  CONSTRAINT batch_strains_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES batches (id) ON DELETE CASCADE,
  CONSTRAINT batch_strains_strain_id_fkey FOREIGN KEY (strain_id) REFERENCES strains (id) ON DELETE CASCADE,
  CONSTRAINT batch_strains_percentage_check CHECK (percentage >= 0 AND percentage <= 100),
  CONSTRAINT batch_strains_lights_check CHECK (lights_assigned >= 0)
);

-- Create index for better query performance
CREATE INDEX idx_batch_strains_batch_id ON public.batch_strains (batch_id);
CREATE INDEX idx_batch_strains_strain_id ON public.batch_strains (strain_id);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_batch_strains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_batch_strains_updated_at
  BEFORE UPDATE ON public.batch_strains
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_strains_updated_at();

-- Add RLS policies if you're using Row Level Security
-- ALTER TABLE public.batch_strains ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust according to your security needs):
-- CREATE POLICY "Users can view batch strains" ON public.batch_strains FOR SELECT USING (true);
-- CREATE POLICY "Users can insert batch strains" ON public.batch_strains FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Users can update batch strains" ON public.batch_strains FOR UPDATE USING (true);
-- CREATE POLICY "Users can delete batch strains" ON public.batch_strains FOR DELETE USING (true);

-- Optional: Add a constraint to ensure total percentage doesn't exceed 100% per batch
-- This would require a more complex trigger or application-level validation
-- since we can't easily check this in a simple constraint

COMMENT ON TABLE public.batch_strains IS 'Stores strain assignments for batches with light assignments and room percentages';
COMMENT ON COLUMN public.batch_strains.batch_id IS 'Reference to the batch';
COMMENT ON COLUMN public.batch_strains.strain_id IS 'Reference to the strain';
COMMENT ON COLUMN public.batch_strains.lights_assigned IS 'Number of lights assigned to this strain in this batch';
COMMENT ON COLUMN public.batch_strains.percentage IS 'Percentage of room space allocated to this strain (0-100)'; 