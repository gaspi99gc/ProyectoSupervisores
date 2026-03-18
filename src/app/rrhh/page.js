import MainLayout from '@/components/MainLayout';
import HRSection from '@/components/HRSection';

export default async function RRHHPage({ searchParams }) {
    const params = await searchParams;
    const initialTab = params?.tab === 'periodos' ? 'periodos' : 'personal';

    return (
        <MainLayout>
            <HRSection initialTab={initialTab} />
        </MainLayout>
    );
}
