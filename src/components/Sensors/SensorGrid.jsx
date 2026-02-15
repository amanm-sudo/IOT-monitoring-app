import React from 'react';
import SensorCard from './SensorCard';

export default function SensorGrid({ sensors }) {
    if (!sensors) return null;

    return (
        <>
            {Object.entries(sensors).map(([key, data]) => (
                <SensorCard key={key} title={key} data={data} />
            ))}
        </>
    );
}
