import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService,
		  {
			  provide: PrismaService,
			  useValue: {
				  organizationApplication: {
					  findUnique: vi.fn().mockResolvedValue({
						  id: 'application-123',
						  status: 'PENDING',
					  }),
					  updateMany: vi.fn().mockResolvedValue({
						  count: 1,
					  }),
				  },
			  },
		  }
	  ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('should return an application by ID', async () => {
	  const result = await service.findApplication('application-123');
	  const mockFunction = service['prisma'].organizationApplication.findUnique;
	  expect(mockFunction).toBeCalledWith({where: {id: 'application-123'} });
	  expect(result).toBeDefined();
	  expect(result).toEqual({
		  id: 'application-123',
		  status: 'PENDING',
	  });
  });
  it('should return null when the application does not exist', async () => {
	  const mockFunction = service['prisma'].organizationApplication.findUnique;
	  vi.mocked(mockFunction).mockResolvedValueOnce(null);
	  const result = await service.findApplication('non-existing-app');
	  expect(mockFunction).toBeCalledWith({
		  where: {
			  id: 'non-existing-app'
		  }
	  });
	  expect(result).toBeNull();
  });
  it('should propagate database errors', async () => {
	  const mockFunction = service['prisma'].organizationApplication.findUnique;
	  vi.mocked(mockFunction).mockRejectedValueOnce(
		  new Error('Database unavailable'),
	  );
	  await expect(service.findApplication('application-123'),
				  ).rejects.toThrow('Database unavailable');
  });
  it('should approve a pending application', async () => {
	  const result = await service.approveApplication('application-123', 'reviewer-123',
													  'Requirements satisfied');
	  const mockFunction = service['prisma'].organizationApplication.updateMany;
	  expect(mockFunction).toHaveBeenCalledWith({
		  where: {
			  id: 'application-123',
			  status: 'PENDING',
		  },
		  data: {
			  status: 'APPROVED',
			  reviewerId: 'reviewer-123',
			  reviewerNote: 'Requirements satisfied',
			  reviewedAt: expect.any(Date),

		  },
	  });
	  expect(result).toEqual(1);
  });
  it('should reject approval when application is not pending', async () => {
	  const mockFunction = service['prisma'].organizationApplication.updateMany;
	  vi.mocked(mockFunction).mockResolvedValueOnce({ count: 0 });
	  await expect(service.approveApplication('application-123', 'reviewer-123',
													  'Requirements satisfied'),
				  ).rejects.toThrow(ConflictException);
	  expect(mockFunction).toHaveBeenCalledWith({
		  where: {
			  id: 'application-123',
			  status: 'PENDING',
		  },
		  data: {
			  status: 'APPROVED',
			  reviewerId: 'reviewer-123',
			  reviewerNote: 'Requirements satisfied',
			  reviewedAt: expect.any(Date),
		  },
	  });
  });
  it('should reject a pending application', async () => {
	  const result = await service.rejectApplication('application-123');
	  const mockFunction = service['prisma'].organizationApplication.updateMany;
	  expect(mockFunction).toHaveBeenCalledWith({
		  where: {
			  id: 'application-123',
			  status: 'PENDING',
		  },
		  data: { status: 'REJECTED', },
	  });
	  expect(result).toEqual(1);
  });
  it('should reject rejection when application is not pending', async () => {
	  const mockFunction = service['prisma'].organizationApplication.updateMany;
	  vi.mocked(mockFunction).mockResolvedValueOnce({ count: 0 });
	  await expect(service.rejectApplication('application-123'),
				  ).rejects.toThrow(ConflictException);
	  expect(mockFunction).toHaveBeenCalledWith({
		  where: {
			  id: 'application-123',
			  status: 'PENDING',
		  },
		  data: { status: 'REJECTED', },
	  });
  });
  it('should reject requesting-changes when application is not pending', async () => {
	  const mockFunction = service['prisma'].organizationApplication.updateMany;
	  vi.mocked(mockFunction).mockResolvedValueOnce({ count: 0 });
	  await expect(service.requestChangesApplication('application-123'),
				  ).rejects.toThrow(ConflictException);
	  expect(mockFunction).toHaveBeenCalledWith({
		  where: {
			  id: 'application-123',
			  status: 'PENDING',
		  },
		  data: { status: 'NEEDS_CHANGES', },
	  });
  });
  it('should request changes from  a pending application', async () => {
	  const result = await service.requestChangesApplication('application-123');
	  const mockFunction = service['prisma'].organizationApplication.updateMany;
	  expect(mockFunction).toHaveBeenCalledWith({
		  where: {
			  id: 'application-123',
			  status: 'PENDING',
		  },
		  data: { status: 'NEEDS_CHANGES', },
	  });
	  expect(result).toEqual(1);
  });
});
