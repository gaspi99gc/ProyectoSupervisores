-- Migration: Add zone column to attendance and create supervisor_routes table
-- Run this against your Turso database

-- Add zone column to attendance table
ALTER TABLE attendance ADD COLUMN zone TEXT DEFAULT 'red';

-- Create supervisor_routes table for route assignments
CREATE TABLE IF NOT EXISTS supervisor_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supervisor_id INTEGER REFERENCES supervisors(id),
  service_id INTEGER REFERENCES services(id),
  route_order INTEGER NOT NULL,
  UNIQUE(supervisor_id, service_id)
);
