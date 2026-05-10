import MainLayout from '@/components/MainLayout';
import HRSection from '@/components/HRSection';

export default async function RRHHPage({ searchParams }) {
    const params = await searchParams;
    const tab = params?.tab;
    const initialTab = tab === 'periodos' ? 'periodos' : tab === 'licencias' ? 'licencias' : 'personal';

    return (
        <MainLayout>
            <HRSection initialTab={initialTab} />
        </MainLayout>
    );
}
